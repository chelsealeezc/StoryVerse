create or replace function public.analytics_event_module(p_event_name text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_event_name like 'home_%'
      or p_event_name like 'auth_%'
      or p_event_name like 'password_recovery_%' then 'acquisition'
    when p_event_name like 'icebreaker_%'
      or p_event_name like 'story_write_%'
      or p_event_name like 'story_paste_%'
      or p_event_name like 'story_input_%'
      or p_event_name like 'story_field_%'
      or p_event_name like 'story_metadata_%'
      or p_event_name like 'story_validation_%'
      or p_event_name like 'story_analysis_%'
      or p_event_name like 'story_label_%'
      or p_event_name like 'story_body_%'
      or p_event_name like 'story_custom_%'
      or p_event_name like 'story_confirmation_%'
      or p_event_name like 'story_submit_%'
      or p_event_name like 'story_autosaved%'
      or p_event_name like 'ai_%'
      or p_event_name like 'publish_%'
      or p_event_name like 'image_%'
      or p_event_name like 'city_%'
      or p_event_name like 'voice_%'
      or p_event_name like 'focus_%' then 'creation'
    when p_event_name like 'recommendation_%'
      or p_event_name = 'star_lobby_viewed'
      or p_event_name like 'star_%'
      or p_event_name like 'lobby_nav_%'
      or p_event_name like 'lobby_search_%'
      or p_event_name = 'lobby_gesture_summary' then 'discovery'
    when p_event_name like 'story_read_%'
      or p_event_name = 'story_panel_closed' then 'reading'
    when p_event_name like 'story_reaction_%'
      or p_event_name like 'lobby_resonance_%'
      or p_event_name like 'resonance_%' then 'resonance'
    when p_event_name like 'tour_%' then 'guidance'
    else 'account'
  end;
$$;

drop function if exists public.analytics_dashboard(timestamptz, timestamptz);

create function public.analytics_dashboard(
  p_start timestamptz default now() - interval '28 days',
  p_end timestamptz default now(),
  p_user_id uuid default null,
  p_priority text default null,
  p_module text default null
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
with filtered as (
  select event.*
  from public.analytics_events event
  where event.occurred_at >= p_start
    and event.occurred_at < p_end
    and (p_user_id is null or event.user_id = p_user_id)
    and (p_priority is null or event.priority::text = p_priority)
    and (p_module is null or public.analytics_event_module(event.event_name) = p_module)
),
overview as (
  select jsonb_build_object(
    'events', count(*),
    'participants', count(distinct participant_key),
    'accounts', count(distinct user_id) filter (where user_id is not null),
    'sessions', count(distinct session_id),
    'creators', count(distinct participant_key) filter (where event_name = 'story_input_snapshot'),
    'activated_users', count(distinct participant_key) filter (
      where event_name = 'story_submit_result' and properties -> 'success' = 'true'::jsonb
    ),
    'lobby_users', count(distinct participant_key) filter (where event_name = 'star_lobby_viewed'),
    'story_readers', count(distinct participant_key) filter (where event_name = 'story_read_started'),
    'meaningful_readers', count(distinct participant_key) filter (
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
      )::numeric / nullif(count(*) filter (where event_name = 'story_read_ended'), 0), 0
    )
  ) as value from filtered
),
creation as (
  select jsonb_build_object(
    'write_views', count(*) filter (where event_name = 'story_write_viewed'),
    'input_snapshots', count(*) filter (where event_name = 'story_input_snapshot'),
    'pasted_snapshots', count(*) filter (
      where event_name = 'story_input_snapshot' and properties -> 'was_pasted' = 'true'::jsonb
    ),
    'paste_rate', coalesce(
      count(*) filter (
        where event_name = 'story_input_snapshot' and properties -> 'was_pasted' = 'true'::jsonb
      )::numeric / nullif(count(*) filter (where event_name = 'story_input_snapshot'), 0), 0
    ),
    'average_input_ms', coalesce(avg(
      case when event_name = 'story_input_snapshot'
        and jsonb_typeof(properties -> 'title_active_ms') = 'number'
        and jsonb_typeof(properties -> 'body_active_ms') = 'number'
      then (properties ->> 'title_active_ms')::numeric + (properties ->> 'body_active_ms')::numeric end
    ), 0),
    'voice_sessions', count(*) filter (
      where event_name = 'story_input_snapshot' and properties -> 'used_voice_input' = 'true'::jsonb
    ),
    'analysis_started', count(*) filter (where event_name = 'story_analysis_started'),
    'analysis_succeeded', count(*) filter (
      where event_name = 'story_analysis_result' and properties -> 'success' = 'true'::jsonb
    ),
    'label_edits', count(*) filter (where event_name = 'ai_label_edited'),
    'publish_clicks', count(*) filter (where event_name = 'publish_clicked'),
    'submit_successes', count(*) filter (
      where event_name = 'story_submit_result' and properties -> 'success' = 'true'::jsonb
    )
  ) as value from filtered
),
discovery as (
  select jsonb_build_object(
    'lobby_views', count(*) filter (where event_name = 'star_lobby_viewed'),
    'star_exposures', count(*) filter (where event_name = 'star_exposed'),
    'star_clicks', count(*) filter (where event_name = 'star_clicked'),
    'searches', count(*) filter (where event_name = 'lobby_search_executed'),
    'zero_result_searches', count(*) filter (
      where event_name = 'lobby_search_executed' and properties -> 'zero_results' = 'true'::jsonb
    ),
    'navigation_clicks', count(*) filter (where event_name = 'lobby_nav_clicked'),
    'preference_confirms', count(*) filter (where event_name = 'lobby_resonance_confirm_clicked'),
    'preference_refreshes', count(*) filter (
      where event_name = 'lobby_resonance_refresh_result' and properties -> 'success' = 'true'::jsonb
    )
  ) as value from filtered
),
reading as (
  select jsonb_build_object(
    'reads_started', count(*) filter (where event_name = 'story_read_started'),
    'reads_ended', count(*) filter (where event_name = 'story_read_ended'),
    'meaningful_reads', count(*) filter (
      where event_name = 'story_read_ended'
        and properties -> 'meaningful_read' = 'true'::jsonb
        and properties -> 'is_own_story' is distinct from 'true'::jsonb
    ),
    'average_read_ms', coalesce(avg(
      case when event_name = 'story_read_ended'
        and jsonb_typeof(properties -> 'active_duration_ms') = 'number'
      then (properties ->> 'active_duration_ms')::numeric end
    ), 0),
    'likes', count(*) filter (
      where event_name = 'story_reaction_result'
        and properties -> 'success' = 'true'::jsonb
        and properties ->> 'reaction' = 'like'
    ),
    'dislikes', count(*) filter (
      where event_name = 'story_reaction_result'
        and properties -> 'success' = 'true'::jsonb
        and properties ->> 'reaction' = 'dislike'
    )
  ) as value from filtered
),
guidance as (
  select jsonb_build_object(
    'tour_started', count(*) filter (where event_name = 'tour_started'),
    'tour_completed', count(*) filter (where event_name = 'tour_completed'),
    'tour_skipped', count(*) filter (where event_name = 'tour_skipped'),
    'icebreaker_views', count(*) filter (where event_name = 'icebreaker_viewed'),
    'resonance_views', count(*) filter (where event_name = 'resonance_page_viewed')
  ) as value from filtered
),
funnel as (
  select jsonb_build_array(
    jsonb_build_object('stage', 'home', 'participants', count(distinct participant_key) filter (where event_name = 'home_viewed')),
    jsonb_build_object('stage', 'signup', 'participants', count(distinct participant_key) filter (
      where event_name = 'auth_result' and properties -> 'success' = 'true'::jsonb and properties ->> 'mode' = 'signup'
    )),
    jsonb_build_object('stage', 'icebreaker', 'participants', count(distinct participant_key) filter (where event_name = 'icebreaker_viewed')),
    jsonb_build_object('stage', 'story_input', 'participants', count(distinct participant_key) filter (where event_name = 'story_input_snapshot')),
    jsonb_build_object('stage', 'analysis', 'participants', count(distinct participant_key) filter (
      where event_name = 'story_analysis_result' and properties -> 'success' = 'true'::jsonb
    )),
    jsonb_build_object('stage', 'published', 'participants', count(distinct participant_key) filter (
      where event_name = 'story_submit_result' and properties -> 'success' = 'true'::jsonb
    )),
    jsonb_build_object('stage', 'resonance', 'participants', count(distinct participant_key) filter (where event_name = 'resonance_page_viewed')),
    jsonb_build_object('stage', 'lobby', 'participants', count(distinct participant_key) filter (where event_name = 'star_lobby_viewed')),
    jsonb_build_object('stage', 'star_click', 'participants', count(distinct participant_key) filter (where event_name = 'star_clicked')),
    jsonb_build_object('stage', 'meaningful_read', 'participants', count(distinct participant_key) filter (
      where event_name = 'story_read_ended'
        and properties -> 'meaningful_read' = 'true'::jsonb
        and properties -> 'is_own_story' is distinct from 'true'::jsonb
    ))
  ) as value from filtered
),
daily as (
  select coalesce(jsonb_agg(to_jsonb(row_data) order by day), '[]'::jsonb) as value
  from (
    select
      (occurred_at at time zone 'Asia/Shanghai')::date as day,
      count(distinct participant_key) as participants,
      count(*) as events,
      count(distinct participant_key) filter (
        where event_name = 'story_read_ended'
          and properties -> 'meaningful_read' = 'true'::jsonb
          and properties -> 'is_own_story' is distinct from 'true'::jsonb
      ) as meaningful_readers
    from filtered group by 1
  ) row_data
),
modules as (
  select coalesce(jsonb_agg(to_jsonb(row_data) order by events desc), '[]'::jsonb) as value
  from (
    select public.analytics_event_module(event_name) as module,
      count(*) as events, count(distinct participant_key) as participants
    from filtered group by 1
  ) row_data
),
event_counts as (
  select coalesce(jsonb_agg(to_jsonb(row_data) order by events desc), '[]'::jsonb) as value
  from (
    select event_name, priority, public.analytics_event_module(event_name) as module,
      count(*) as events, count(distinct participant_key) as participants
    from filtered group by event_name, priority
  ) row_data
),
searches as (
  select coalesce(jsonb_agg(to_jsonb(row_data) order by searches desc), '[]'::jsonb) as value
  from (
    select properties ->> 'raw_query' as query, count(*) as searches,
      count(*) filter (where properties -> 'zero_results' = 'true'::jsonb) as zero_results
    from filtered where event_name = 'lobby_search_executed'
    group by properties ->> 'raw_query' order by count(*) desc limit 30
  ) row_data
),
navigation as (
  select coalesce(jsonb_agg(to_jsonb(row_data) order by clicks desc), '[]'::jsonb) as value
  from (
    select coalesce(properties ->> 'view', properties ->> 'view_mode', 'unknown') as view,
      count(*) as clicks, count(distinct participant_key) as participants
    from filtered where event_name = 'lobby_nav_clicked' group by 1
  ) row_data
),
accounts as (
  select coalesce(jsonb_agg(to_jsonb(row_data) order by last_event_at desc), '[]'::jsonb) as value
  from (
    select profile.id, profile.username, profile.display_name, profile.status,
      min(event.occurred_at) as first_event_at, max(event.occurred_at) as last_event_at,
      count(*) as events, count(distinct event.session_id) as sessions,
      count(*) filter (
        where event.event_name = 'story_read_ended'
          and event.properties -> 'meaningful_read' = 'true'::jsonb
          and event.properties -> 'is_own_story' is distinct from 'true'::jsonb
      ) as meaningful_reads
    from filtered event join public.profiles profile on profile.id = event.user_id
    group by profile.id, profile.username, profile.display_name, profile.status
    order by max(event.occurred_at) desc limit 100
  ) row_data
),
selected_account as (
  select to_jsonb(row_data) as value
  from (
    select id, username, display_name, status, created_at
    from public.profiles where id = p_user_id
  ) row_data
),
account_stories as (
  select jsonb_build_object(
    'total', count(*),
    'published', count(*) filter (where status = 'published'),
    'pending_review', count(*) filter (where status = 'pending_review'),
    'private', count(*) filter (where status = 'private'),
    'needs_edit', count(*) filter (where status = 'needs_edit')
  ) as value from public.stories where user_id = p_user_id
),
recent_events as (
  select coalesce(jsonb_agg(to_jsonb(row_data) order by occurred_at desc), '[]'::jsonb) as value
  from (
    select event_id, event_name, priority, occurred_at, page_id, route, session_id,
      lobby_view_id, recommendation_batch_id, public.analytics_event_module(event_name) as module, properties
    from filtered order by occurred_at desc limit 200
  ) row_data
)
select jsonb_build_object(
  'range', jsonb_build_object('start', p_start, 'end', p_end, 'timezone', 'Asia/Shanghai'),
  'filters', jsonb_build_object('user_id', p_user_id, 'priority', p_priority, 'module', p_module),
  'overview', (select value from overview),
  'creation', (select value from creation),
  'discovery', (select value from discovery),
  'reading', (select value from reading),
  'guidance', (select value from guidance),
  'funnel', (select value from funnel),
  'daily', (select value from daily),
  'modules', (select value from modules),
  'event_counts', (select value from event_counts),
  'searches', (select value from searches),
  'navigation', (select value from navigation),
  'accounts', (select value from accounts),
  'selected_account', (select value from selected_account),
  'account_stories', (select value from account_stories),
  'recent_events', (select value from recent_events)
);
$$;

revoke all on function public.analytics_event_module(text) from public, anon, authenticated;
grant execute on function public.analytics_event_module(text) to service_role;
revoke all on function public.analytics_dashboard(timestamptz, timestamptz, uuid, text, text) from public, anon, authenticated;
grant execute on function public.analytics_dashboard(timestamptz, timestamptz, uuid, text, text) to service_role;
