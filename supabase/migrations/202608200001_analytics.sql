create type public.analytics_priority as enum ('P0', 'P1', 'P2');

create table public.analytics_events (
  event_id uuid primary key,
  event_name text not null,
  event_version smallint not null default 1,
  priority public.analytics_priority not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  participant_key text not null,
  anonymous_id uuid not null,
  session_id uuid not null,
  page_view_id uuid not null,
  lobby_view_id uuid,
  recommendation_batch_id uuid references public.recommendation_batches(id) on delete set null,
  page_id text not null,
  route text not null,
  component text,
  language text not null check (language in ('zh', 'en')),
  theme text not null check (theme in ('day', 'night')),
  device_type text not null check (device_type in ('desktop', 'tablet', 'mobile')),
  viewport jsonb not null default '{}'::jsonb,
  browser text not null,
  os text not null,
  study_id text not null default 'storyverse_lab_v1',
  condition_id text not null default 'default',
  app_version text not null,
  environment text not null check (environment in ('local', 'preview', 'production', 'test')),
  properties jsonb not null default '{}'::jsonb,
  constraint analytics_event_name_format check (event_name ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint analytics_event_version_positive check (event_version > 0),
  constraint analytics_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint analytics_viewport_object check (jsonb_typeof(viewport) = 'object')
);

create index analytics_events_occurred_idx on public.analytics_events(occurred_at desc);
create index analytics_events_name_occurred_idx on public.analytics_events(event_name, occurred_at desc);
create index analytics_events_participant_idx on public.analytics_events(participant_key, occurred_at desc);
create index analytics_events_user_idx on public.analytics_events(user_id, occurred_at desc) where user_id is not null;
create index analytics_events_lobby_idx on public.analytics_events(lobby_view_id, event_name) where lobby_view_id is not null;
create index analytics_events_story_idx on public.analytics_events((properties ->> 'story_id'), occurred_at desc)
  where properties ? 'story_id';

comment on table public.analytics_events is
  'First-party StoryVerse experiment events. Rows are intentionally retained when accounts or stories are deleted.';

create table public.analytics_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, window_start)
);

create or replace function public.check_analytics_rate_limit(
  p_key_hash text,
  p_limit integer default 120,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  bucket timestamptz;
  next_count integer;
begin
  if p_key_hash is null or length(p_key_hash) < 16 then
    return false;
  end if;
  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / greatest(1, p_window_seconds)) * greatest(1, p_window_seconds)
  );
  insert into public.analytics_rate_limits(key_hash, window_start, request_count)
  values (p_key_hash, bucket, 1)
  on conflict (key_hash, window_start)
  do update set request_count = analytics_rate_limits.request_count + 1
  returning request_count into next_count;
  delete from public.analytics_rate_limits where window_start < clock_timestamp() - interval '1 day';
  return next_count <= greatest(1, p_limit);
end;
$$;

create or replace function public.analytics_dashboard(
  p_start timestamptz default now() - interval '28 days',
  p_end timestamptz default now()
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
with filtered as (
  select *
  from public.analytics_events
  where occurred_at >= p_start and occurred_at < p_end
),
week_bounds as (
  select
    date_trunc('week', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai' as week_start,
    (date_trunc('week', timezone('Asia/Shanghai', now())) + interval '7 days') at time zone 'Asia/Shanghai' as week_end
),
overview as (
  select jsonb_build_object(
    'total_events', count(*),
    'active_participants', count(distinct participant_key),
    'sessions', count(distinct session_id),
    'lobby_views', count(distinct lobby_view_id) filter (where event_name = 'star_lobby_viewed'),
    'star_exposures', count(*) filter (where event_name = 'star_exposed'),
    'star_clicks', count(*) filter (where event_name = 'star_clicked'),
    'meaningful_reads', count(*) filter (
      where event_name = 'story_read_ended'
        and properties -> 'meaningful_read' = 'true'::jsonb
        and properties -> 'is_own_story' is distinct from 'true'::jsonb
    ),
    'star_ctr', coalesce(
      count(*) filter (where event_name = 'star_clicked')::numeric /
      nullif(count(*) filter (where event_name = 'star_exposed'), 0), 0
    ),
    'meaningful_read_rate', coalesce(
      count(*) filter (
        where event_name = 'story_read_ended'
          and properties -> 'meaningful_read' = 'true'::jsonb
          and properties -> 'is_own_story' is distinct from 'true'::jsonb
      )::numeric /
      nullif(count(*) filter (where event_name = 'story_read_ended'), 0), 0
    )
  ) as value from filtered
),
wru as (
  select count(distinct participant_key) as value
  from public.analytics_events, week_bounds
  where occurred_at >= week_start and occurred_at < week_end
    and event_name = 'story_read_ended'
    and properties -> 'meaningful_read' = 'true'::jsonb
    and properties -> 'is_own_story' is distinct from 'true'::jsonb
),
event_counts as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_name', event_name, 'priority', priority, 'count', count
  ) order by count desc), '[]'::jsonb) as value
  from (
    select event_name, priority, count(*) as count
    from filtered group by event_name, priority
  ) counts
),
daily as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', day, 'participants', participants, 'events', events
  ) order by day), '[]'::jsonb) as value
  from (
    select (occurred_at at time zone 'Asia/Shanghai')::date as day,
      count(distinct participant_key) as participants,
      count(*) as events
    from filtered group by 1
  ) days
),
funnel as (
  select jsonb_agg(jsonb_build_object(
    'event_name', names.event_name,
    'participants', (select count(distinct participant_key) from filtered where event_name = names.event_name)
  ) order by names.position) as value
  from (values
    (1, 'home_viewed'),
    (2, 'auth_result'),
    (3, 'icebreaker_viewed'),
    (4, 'story_write_viewed'),
    (5, 'ai_organize_clicked'),
    (6, 'story_submit_result'),
    (7, 'resonance_page_viewed'),
    (8, 'star_lobby_viewed'),
    (9, 'star_clicked'),
    (10, 'story_read_ended')
  ) names(position, event_name)
),
searches as (
  select coalesce(jsonb_agg(to_jsonb(search_rows) order by searches desc), '[]'::jsonb) as value
  from (
    select properties ->> 'raw_query' as query,
      count(*) as searches,
      count(*) filter (where properties -> 'zero_results' = 'true'::jsonb) as zero_results
    from filtered
    where event_name = 'lobby_search_executed'
    group by properties ->> 'raw_query'
    order by count(*) desc
    limit 30
  ) search_rows
),
quality as (
  select jsonb_build_object(
    'missing_page_id', count(*) filter (where page_id = ''),
    'missing_app_version', count(*) filter (where app_version = ''),
    'late_events', count(*) filter (where received_at - occurred_at > interval '5 minutes'),
    'duplicate_event_ids', 0
  ) as value from filtered
)
select jsonb_build_object(
  'range', jsonb_build_object('start', p_start, 'end', p_end, 'timezone', 'Asia/Shanghai'),
  'overview', (select value || jsonb_build_object('weekly_meaningful_resonance_users', (select value from wru)) from overview),
  'event_counts', (select value from event_counts),
  'daily', (select value from daily),
  'funnel', (select value from funnel),
  'searches', (select value from searches),
  'quality', (select value from quality)
);
$$;

alter table public.analytics_events enable row level security;
alter table public.analytics_rate_limits enable row level security;

create policy analytics_events_admin_read on public.analytics_events
  for select to authenticated using ((select private.is_admin()));

grant select on public.analytics_events to authenticated;
grant all privileges on public.analytics_events, public.analytics_rate_limits to service_role;
grant execute on function public.check_analytics_rate_limit(text, integer, integer) to service_role;
grant execute on function public.analytics_dashboard(timestamptz, timestamptz) to service_role;
revoke all on function public.check_analytics_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.analytics_dashboard(timestamptz, timestamptz) from public, anon, authenticated;
