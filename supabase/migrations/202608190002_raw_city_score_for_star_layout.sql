-- Keep the geographic proximity score independent from the user's recommendation direction.
-- `city_score` is consumed by StarLobby as physical radius, while `city_direction_score`
-- is used only inside the recommendation formula.
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
      city_score,
      case when preference.city_mode = 'different' then 1.0 - city_score else city_score end
        as city_direction_score,
      case when preference.stage_mode = 'different' then 1.0 - life_score else life_score end as life_score,
      case when preference.theme_mode = 'different' then 1.0 - theme_score else theme_score end as theme_score,
      semantic_score
    from raw_scores
  ), ranked as (
    select
      *,
      city_direction_score * (config.weights->>'city')::double precision
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
