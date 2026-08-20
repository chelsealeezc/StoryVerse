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
  select * from public.analytics_events where occurred_at >= p_start and occurred_at < p_end
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
      )::numeric / nullif(count(*) filter (where event_name = 'story_read_ended'), 0), 0
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
    'voice_snapshots', count(*) filter (
      where event_name = 'story_input_snapshot' and properties -> 'used_voice_input' = 'true'::jsonb
    ),
    'focus_snapshots', count(*) filter (
      where event_name = 'story_input_snapshot' and properties -> 'used_focus_mode' = 'true'::jsonb
    ),
    'average_input_ms', coalesce(avg(
      case when event_name = 'story_input_snapshot'
        and jsonb_typeof(properties -> 'title_active_ms') = 'number'
        and jsonb_typeof(properties -> 'body_active_ms') = 'number'
      then (properties ->> 'title_active_ms')::numeric + (properties ->> 'body_active_ms')::numeric end
    ), 0),
    'ai_organize_clicks', count(*) filter (where event_name = 'ai_organize_clicked'),
    'analysis_successes', count(*) filter (
      where event_name = 'story_analysis_result' and properties -> 'success' = 'true'::jsonb
    ),
    'label_edited_stories', count(distinct properties ->> 'story_id') filter (where event_name = 'ai_label_edited'),
    'publish_clicks', count(*) filter (where event_name = 'publish_clicked'),
    'submit_successes', count(*) filter (
      where event_name = 'story_submit_result' and properties -> 'success' = 'true'::jsonb
    )
  ) as value from filtered
),
star_metrics as (
  select jsonb_build_object(
    'exposures', count(*) filter (where event_name = 'star_exposed'),
    'exposed_stories', count(distinct properties ->> 'story_id') filter (where event_name = 'star_exposed'),
    'clicks', count(*) filter (where event_name = 'star_clicked'),
    'reads_started', count(*) filter (where event_name = 'story_read_started'),
    'reads_ended', count(*) filter (where event_name = 'story_read_ended'),
    'meaningful_reads', count(*) filter (
      where event_name = 'story_read_ended' and properties -> 'meaningful_read' = 'true'::jsonb
    ),
    'average_active_read_ms', coalesce(avg(
      case when event_name = 'story_read_ended' and jsonb_typeof(properties -> 'active_duration_ms') = 'number'
      then (properties ->> 'active_duration_ms')::numeric end
    ), 0),
    'reaction_clicks', count(*) filter (where event_name = 'story_reaction_clicked'),
    'resonance_confirms', count(*) filter (where event_name = 'lobby_resonance_confirm_clicked'),
    'resonance_refresh_successes', count(*) filter (
      where event_name = 'lobby_resonance_refresh_result' and properties -> 'success' = 'true'::jsonb
    )
  ) as value from filtered
),
event_counts as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_name', event_name, 'priority', priority, 'count', count
  ) order by count desc), '[]'::jsonb) as value
  from (select event_name, priority, count(*) as count from filtered group by event_name, priority) counts
),
daily as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', day, 'participants', participants, 'events', events
  ) order by day), '[]'::jsonb) as value
  from (
    select (occurred_at at time zone 'Asia/Shanghai')::date as day,
      count(distinct participant_key) as participants, count(*) as events
    from filtered group by 1
  ) days
),
funnel as (
  select jsonb_agg(jsonb_build_object(
    'event_name', names.event_name,
    'participants', (select count(distinct participant_key) from filtered where event_name = names.event_name)
  ) order by names.position) as value
  from (values
    (1, 'home_viewed'), (2, 'auth_result'), (3, 'icebreaker_viewed'), (4, 'story_write_viewed'),
    (5, 'ai_organize_clicked'), (6, 'story_submit_result'), (7, 'resonance_page_viewed'),
    (8, 'star_lobby_viewed'), (9, 'star_clicked'), (10, 'story_read_ended')
  ) names(position, event_name)
),
searches as (
  select coalesce(jsonb_agg(to_jsonb(search_rows) order by searches desc), '[]'::jsonb) as value
  from (
    select properties ->> 'raw_query' as query, count(*) as searches,
      count(*) filter (where properties -> 'zero_results' = 'true'::jsonb) as zero_results
    from filtered where event_name = 'lobby_search_executed'
    group by properties ->> 'raw_query' order by count(*) desc limit 30
  ) search_rows
),
navigation as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'view', view_mode, 'clicks', clicks, 'participants', participants
  ) order by clicks desc), '[]'::jsonb) as value
  from (
    select properties ->> 'view' as view_mode, count(*) as clicks, count(distinct participant_key) as participants
    from filtered where event_name = 'lobby_nav_clicked' group by properties ->> 'view'
  ) nav_rows
),
cohorts as (
  select participant_key, min((occurred_at at time zone 'Asia/Shanghai')::date) as first_day
  from public.analytics_events group by participant_key
),
eligible_cohorts as (
  select * from cohorts
  where first_day >= (p_start at time zone 'Asia/Shanghai')::date
    and first_day <= (p_end at time zone 'Asia/Shanghai')::date - 7
),
retention as (
  select jsonb_build_object(
    'eligible_participants', count(*),
    'day_1_participants', count(*) filter (where exists (
      select 1 from public.analytics_events e where e.participant_key = eligible_cohorts.participant_key
        and (e.occurred_at at time zone 'Asia/Shanghai')::date = eligible_cohorts.first_day + 1
    )),
    'day_7_participants', count(*) filter (where exists (
      select 1 from public.analytics_events e where e.participant_key = eligible_cohorts.participant_key
        and (e.occurred_at at time zone 'Asia/Shanghai')::date = eligible_cohorts.first_day + 7
    )),
    'day_1_rate', coalesce(count(*) filter (where exists (
      select 1 from public.analytics_events e where e.participant_key = eligible_cohorts.participant_key
        and (e.occurred_at at time zone 'Asia/Shanghai')::date = eligible_cohorts.first_day + 1
    ))::numeric / nullif(count(*), 0), 0),
    'day_7_rate', coalesce(count(*) filter (where exists (
      select 1 from public.analytics_events e where e.participant_key = eligible_cohorts.participant_key
        and (e.occurred_at at time zone 'Asia/Shanghai')::date = eligible_cohorts.first_day + 7
    ))::numeric / nullif(count(*), 0), 0)
  ) as value from eligible_cohorts
),
duplicate_exposures as (
  select coalesce(sum(event_count - 1), 0) as value
  from (
    select count(*) as event_count from filtered
    where event_name = 'star_exposed' and lobby_view_id is not null and properties ->> 'story_id' is not null
    group by lobby_view_id, properties ->> 'story_id', properties ->> 'view_mode' having count(*) > 1
  ) duplicates
),
quality as (
  select jsonb_build_object(
    'missing_page_id', count(*) filter (where page_id = ''),
    'missing_app_version', count(*) filter (where app_version = ''),
    'late_events', count(*) filter (where received_at - occurred_at > interval '5 minutes'),
    'duplicate_event_ids', 0,
    'duplicate_star_exposures', (select value from duplicate_exposures),
    'unexpected_event_versions', count(*) filter (where event_version <> 1),
    'result_events', count(*) filter (where properties ? 'success'),
    'failed_result_events', count(*) filter (where properties -> 'success' = 'false'::jsonb),
    'result_failure_rate', coalesce(
      count(*) filter (where properties -> 'success' = 'false'::jsonb)::numeric /
      nullif(count(*) filter (where properties ? 'success'), 0), 0
    )
  ) as value from filtered
)
select jsonb_build_object(
  'range', jsonb_build_object('start', p_start, 'end', p_end, 'timezone', 'Asia/Shanghai'),
  'overview', (select value || jsonb_build_object('weekly_meaningful_resonance_users', (select value from wru)) from overview),
  'creation', (select value from creation),
  'star', (select value from star_metrics),
  'event_counts', (select value from event_counts),
  'daily', (select value from daily),
  'funnel', (select value from funnel),
  'searches', (select value from searches),
  'navigation', (select value from navigation),
  'retention', (select value from retention),
  'quality', (select value from quality)
);
$$;

revoke all on function public.analytics_dashboard(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.analytics_dashboard(timestamptz, timestamptz) to service_role;
