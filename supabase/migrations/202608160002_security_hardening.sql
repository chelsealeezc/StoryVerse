-- Keep authorization helpers outside the schemas exposed by the Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_active_user() from public;
grant execute on function private.is_admin(), private.is_active_user() to anon, authenticated, service_role;

alter function public.stage_index(text) set search_path = '';
alter function public.haversine_km(double precision, double precision, double precision, double precision)
  set search_path = '';

-- Recommendation generation is a server operation. The Edge Function authenticates
-- the user and calls this function with the Secret key.
drop function if exists public.refresh_recommendations(integer);

create or replace function public.refresh_recommendations(p_user_id uuid, p_limit integer default 100)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := p_user_id;
  reference_story public.stories%rowtype;
  reference_embedding public.story_embeddings%rowtype;
  preference public.resonance_preferences%rowtype;
  config public.algorithm_configs%rowtype;
  batch_id uuid;
  result_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if current_user_id is null then raise exception 'user id required'; end if;
  if not exists (select 1 from public.profiles where id = current_user_id and status = 'active') then
    raise exception 'account unavailable';
  end if;

  select * into config from public.algorithm_configs where status = 'published' order by version desc limit 1;
  select * into preference from public.resonance_preferences where user_id = current_user_id;
  if not found then
    insert into public.resonance_preferences(user_id) values (current_user_id)
    returning * into preference;
  end if;

  select s.* into reference_story
  from public.stories s
  join public.story_embeddings e
    on e.story_id = s.id
   and e.story_embedding is not null
   and e.theme_embedding is not null
  where s.user_id = current_user_id
    and s.status = 'published'
  order by s.published_at desc nulls last, s.created_at desc
  limit 1;

  if found then
    select * into reference_embedding
    from public.story_embeddings
    where story_id = reference_story.id;
  end if;

  insert into public.recommendation_batches(
    user_id,
    reference_story_id,
    algorithm_config_id,
    formula_version,
    city_mode,
    stage_mode,
    theme_mode
  ) values (
    current_user_id,
    reference_story.id,
    config.id,
    'storyverse-recommendation-v1',
    preference.city_mode,
    preference.stage_mode,
    preference.theme_mode
  ) returning id into batch_id;

  if reference_story.id is null then return batch_id; end if;

  insert into public.recommendation_results(
    batch_id,
    story_id,
    rank,
    city_score,
    life_score,
    theme_score,
    semantic_score,
    final_score
  )
  with raw_scores as (
    select
      s.id as story_id,
      case
        when reference_story.latitude is null
          or reference_story.longitude is null
          or s.latitude is null
          or s.longitude is null then 0.5
        else 1.0 / (
          1.0 + public.haversine_km(
            reference_story.latitude,
            reference_story.longitude,
            s.latitude,
            s.longitude
          ) / 500.0
        )
      end as city_score,
      (
        greatest(0.0, least(1.0, 1.0 - abs(reference_story.age - s.age)::double precision / 60.0))
          * (config.weights->>'age')::double precision
        + greatest(
            0.0,
            least(
              1.0,
              1.0 - abs(
                public.stage_index(reference_story.life_stage) - public.stage_index(s.life_stage)
              ) / 4.0
            )
          ) * (config.weights->>'stage')::double precision
        + case when reference_story.gender = s.gender then 1.0 else 0.0 end
          * (config.weights->>'gender')::double precision
      ) as life_score,
      greatest(0.0, least(1.0, 1.0 - (reference_embedding.theme_embedding <=> e.theme_embedding)))
        as theme_score,
      greatest(0.0, least(1.0, 1.0 - (reference_embedding.story_embedding <=> e.story_embedding)))
        as semantic_score
    from public.stories s
    join public.story_embeddings e on e.story_id = s.id
    where s.status = 'published'
      and s.user_id <> current_user_id
      and e.story_embedding is not null
      and e.theme_embedding is not null
      and e.model = reference_embedding.model
      and e.model_version = reference_embedding.model_version
  ), directed as (
    select
      story_id,
      case when preference.city_mode = 'different' then 1.0 - city_score else city_score end as city_score,
      case when preference.stage_mode = 'different' then 1.0 - life_score else life_score end as life_score,
      case when preference.theme_mode = 'different' then 1.0 - theme_score else theme_score end as theme_score,
      semantic_score
    from raw_scores
  ), ranked as (
    select
      *,
      city_score * (config.weights->>'city')::double precision
        + life_score * (config.weights->>'life')::double precision
        + theme_score * (config.weights->>'theme')::double precision
        + semantic_score * (config.weights->>'semantic')::double precision as final_score
    from directed
  )
  select
    batch_id,
    story_id,
    row_number() over (order by final_score desc, story_id)::smallint,
    city_score,
    life_score,
    theme_score,
    semantic_score,
    final_score
  from ranked
  order by final_score desc, story_id
  limit result_limit;

  return batch_id;
end;
$$;

revoke all on function public.refresh_recommendations(uuid, integer) from public, anon, authenticated;
grant execute on function public.refresh_recommendations(uuid, integer) to service_role;

-- Rebuild policies with non-public authorization helpers and init-plan friendly auth lookups.
drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists story_types_admin on public.story_types;
drop policy if exists drafts_owner on public.story_drafts;
drop policy if exists stories_read on public.stories;
drop policy if exists story_versions_read on public.story_versions;
drop policy if exists moderation_results_read on public.moderation_results;
drop policy if exists review_cases_read on public.review_cases;
drop policy if exists review_cases_admin on public.review_cases;
drop policy if exists embeddings_owner_read on public.story_embeddings;
drop policy if exists resonance_owner on public.resonance_preferences;
drop policy if exists algorithm_config_read on public.algorithm_configs;
drop policy if exists algorithm_config_admin on public.algorithm_configs;
drop policy if exists recommendation_batches_owner on public.recommendation_batches;
drop policy if exists recommendation_results_owner on public.recommendation_results;
drop policy if exists generated_images_read on public.generated_images;
drop policy if exists reactions_owner on public.reactions;
drop policy if exists reports_owner_insert on public.reports;
drop policy if exists reports_owner_select on public.reports;
drop policy if exists notifications_owner on public.notifications;
drop policy if exists notifications_owner_update on public.notifications;
drop policy if exists feedback_owner_insert on public.feedback;
drop policy if exists feedback_owner_select on public.feedback;
drop policy if exists import_batches_admin on public.import_batches;
drop policy if exists import_failures_admin on public.import_failures;
drop policy if exists ai_tasks_read on public.ai_tasks;
drop policy if exists audit_admin on public.admin_audit_logs;

create policy profiles_self_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create policy profiles_self_update on public.profiles
for update to authenticated
using (
  (id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
)
with check (
  (id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy story_types_admin_insert on public.story_types
for insert to authenticated
with check ((select private.is_admin()));
create policy story_types_admin_update on public.story_types
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy story_types_admin_delete on public.story_types
for delete to authenticated
using ((select private.is_admin()));

create policy drafts_owner on public.story_drafts
for all to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
)
with check (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy stories_read on public.stories
for select to anon, authenticated
using (
  status = 'published'
  or (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy story_versions_read on public.story_versions
for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy moderation_results_read on public.moderation_results
for select to authenticated
using (
  (select private.is_admin())
  or (
    (select private.is_active_user())
    and exists (
      select 1
      from public.stories
      where stories.id = moderation_results.story_id
        and stories.user_id = (select auth.uid())
    )
  )
);

create policy review_cases_read on public.review_cases
for select to authenticated
using (
  (author_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);
create policy review_cases_admin_insert on public.review_cases
for insert to authenticated
with check ((select private.is_admin()));
create policy review_cases_admin_update on public.review_cases
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy review_cases_admin_delete on public.review_cases
for delete to authenticated
using ((select private.is_admin()));

create policy embeddings_owner_read on public.story_embeddings
for select to authenticated
using (
  (select private.is_admin())
  or (
    (select private.is_active_user())
    and exists (
      select 1
      from public.stories
      where stories.id = story_embeddings.story_id
        and stories.user_id = (select auth.uid())
    )
  )
);

create policy resonance_owner on public.resonance_preferences
for all to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_user()))
with check (user_id = (select auth.uid()) and (select private.is_active_user()));

create policy algorithm_config_read on public.algorithm_configs
for select to anon, authenticated
using (status = 'published' or (select private.is_admin()));
create policy algorithm_config_admin_insert on public.algorithm_configs
for insert to authenticated
with check ((select private.is_admin()));
create policy algorithm_config_admin_update on public.algorithm_configs
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy algorithm_config_admin_delete on public.algorithm_configs
for delete to authenticated
using ((select private.is_admin()));

create policy recommendation_batches_owner on public.recommendation_batches
for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy recommendation_results_owner on public.recommendation_results
for select to authenticated
using (
  (select private.is_admin())
  or (
    (select private.is_active_user())
    and exists (
      select 1
      from public.recommendation_batches b
      where b.id = recommendation_results.batch_id
        and b.user_id = (select auth.uid())
    )
  )
);

create policy generated_images_read on public.generated_images
for select to anon, authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
  or exists (
    select 1
    from public.stories
    where stories.id = generated_images.story_id
      and stories.status = 'published'
  )
);

create policy reactions_owner on public.reactions
for all to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_user()))
with check (user_id = (select auth.uid()) and (select private.is_active_user()));

create policy reports_owner_insert on public.reports
for insert to authenticated
with check (reporter_id = (select auth.uid()) and (select private.is_active_user()));
create policy reports_owner_select on public.reports
for select to authenticated
using (
  (reporter_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy notifications_owner on public.notifications
for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);
create policy notifications_owner_update on public.notifications
for update to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
)
with check (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy feedback_owner_insert on public.feedback
for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_active_user()));
create policy feedback_owner_select on public.feedback
for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy import_batches_admin on public.import_batches
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy import_failures_admin on public.import_failures
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy ai_tasks_read on public.ai_tasks
for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or (select private.is_admin())
);

create policy audit_admin on public.admin_audit_logs
for select to authenticated
using ((select private.is_admin()));

drop function if exists public.is_admin(uuid);
drop function if exists public.is_active_user(uuid);
