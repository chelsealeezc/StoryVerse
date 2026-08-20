-- StoryVerse initial Supabase schema.
-- The migration is the source of truth for local, staging, and production databases.

create extension if not exists citext with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgmq;

create type public.app_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.story_status as enum (
  'draft',
  'analyzing',
  'pending_review',
  'needs_confirmation',
  'published',
  'private',
  'needs_edit',
  'removed'
);
create type public.moderation_decision as enum ('pass', 'human_review');
create type public.moderation_category as enum (
  'privacy',
  'attack',
  'distress',
  'crisis',
  'hate',
  'minor',
  'explicit',
  'spam'
);
create type public.review_source as enum ('machine', 'report', 'appeal');
create type public.review_status as enum ('pending', 'reviewing', 'approved', 'needs_edit', 'cancelled');
create type public.reaction_kind as enum ('like', 'dislike');
create type public.resonance_mode as enum ('similar', 'different');
create type public.ai_task_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');
create type public.image_style as enum ('clay-3d', 'indie-zine', 'retro-collage');
create type public.image_status as enum ('queued', 'generating', 'ready', 'failed', 'blocked', 'invalidated');
create type public.notification_status as enum ('pending', 'reviewing', 'resolved');
create type public.notification_kind as enum ('flagged', 'kept', 'needs_edit', 'removed', 'system');
create type public.config_status as enum ('draft', 'published');
create type public.import_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.source_kind as enum ('user', 'seed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext not null unique,
  display_name text not null,
  anonymous_number integer not null check (anonymous_number between 100 and 999999),
  role public.app_role not null default 'user',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username::text ~ '^[A-Za-z0-9_]{4,20}$'),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 40)
);

-- Never expose this table through a user-facing query. The service role is the only writer/reader.
create table public.account_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  internal_email extensions.citext not null unique,
  security_question text not null,
  answer_salt text not null,
  answer_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_types (
  id text primary key,
  parent_type text not null,
  label_zh text not null,
  label_en text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  guide text not null default '',
  custom_guide text not null default '',
  title text not null default '',
  body text not null default '',
  mood text not null default '',
  life_stage text not null default '',
  age smallint check (age between 1 and 120),
  gender text not null default '',
  city text not null default '',
  city_name_en text not null default '',
  city_country text not null default '',
  latitude double precision,
  longitude double precision,
  people text[] not null default '{}',
  started_at timestamptz not null default now(),
  edits integer not null default 0,
  pasted_chars integer not null default 0,
  saves integer not null default 0,
  version integer not null default 1,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_drafts_latitude check (latitude is null or latitude between -90 and 90),
  constraint story_drafts_longitude check (longitude is null or longitude between -180 and 180)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  filename text not null,
  status public.import_status not null default 'pending',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  failed_rows integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_display_name text not null,
  title text not null,
  body text not null,
  excerpt text not null default '',
  guide text not null default '',
  custom_guide text not null default '',
  mood text not null,
  life_stage text not null,
  age smallint not null check (age between 1 and 120),
  gender text not null,
  city text not null,
  city_name_en text not null default '',
  city_country text not null default '',
  latitude double precision,
  longitude double precision,
  people text[] not null,
  edits integer not null default 0,
  pasted_chars integer not null default 0,
  saves integer not null default 0,
  status public.story_status not null default 'analyzing',
  status_before_removal public.story_status,
  moderation_decision public.moderation_decision,
  moderation_categories public.moderation_category[] not null default '{}',
  ai_suggested_title text,
  ai_type_id text references public.story_types(id),
  ai_type_confidence double precision check (ai_type_confidence is null or ai_type_confidence between 0 and 1),
  ai_type_candidates jsonb not null default '[]'::jsonb,
  final_type_id text references public.story_types(id),
  ai_themes text[] not null default '{}',
  ai_model text,
  ai_prompt_version text,
  ai_analyzed_at timestamptz,
  final_themes text[] not null default '{}',
  emotion_tags jsonb not null default '[]'::jsonb,
  visual_status public.image_status not null default 'queued',
  source_kind public.source_kind not null default 'user',
  import_batch_id uuid references public.import_batches(id) on delete set null,
  external_id text,
  source_note text,
  moderation_skipped boolean not null default false,
  content_hash text not null,
  analysis_version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stories_body_length check (char_length(btrim(body)) between 100 and 1500),
  constraint stories_title_length check (char_length(title) <= 120),
  constraint stories_gender_required check (char_length(btrim(gender)) > 0),
  constraint stories_stage_required check (char_length(btrim(life_stage)) > 0),
  constraint stories_city_required check (char_length(btrim(city)) > 0),
  constraint stories_people_required check (cardinality(people) > 0),
  constraint stories_latitude check (latitude is null or latitude between -90 and 90),
  constraint stories_longitude check (longitude is null or longitude between -180 and 180),
  constraint stories_final_themes_count check (
    status not in ('published', 'needs_confirmation') or cardinality(final_themes) = 2
  )
);

create unique index stories_external_id_unique
  on public.stories(external_id)
  where source_kind = 'seed' and external_id is not null;
create index stories_public_created_idx on public.stories(status, published_at desc nulls last, created_at desc);
create index stories_owner_idx on public.stories(user_id, created_at desc);
create index stories_type_idx on public.stories(final_type_id) where status = 'published';

create table public.story_versions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (story_id, version)
);

create table public.moderation_results (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  decision public.moderation_decision not null,
  categories public.moderation_category[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  reason text not null default '',
  prompt_version text not null,
  model text not null,
  input_hash text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
create index moderation_results_story_idx on public.moderation_results(story_id, created_at desc);

create table public.review_cases (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  source public.review_source not null,
  status public.review_status not null default 'pending',
  priority smallint not null default 0,
  categories public.moderation_category[] not null default '{}',
  reason text not null default '',
  appeal_note text,
  has_been_opened boolean not null default false,
  reviewer_id uuid references public.profiles(id),
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index review_cases_open_story_source_unique
  on public.review_cases(story_id, source)
  where status in ('pending', 'reviewing');
create index review_cases_queue_idx on public.review_cases(status, priority desc, created_at);

create table public.story_embeddings (
  story_id uuid primary key references public.stories(id) on delete cascade,
  story_embedding extensions.vector(1024),
  theme_embedding extensions.vector(1024),
  model text not null,
  model_version text not null,
  content_hash text not null,
  theme_hash text not null,
  generated_at timestamptz not null default now()
);
create index story_embeddings_story_hnsw on public.story_embeddings
  using hnsw (story_embedding extensions.vector_cosine_ops)
  where story_embedding is not null;
create index story_embeddings_theme_hnsw on public.story_embeddings
  using hnsw (theme_embedding extensions.vector_cosine_ops)
  where theme_embedding is not null;

create table public.resonance_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  city_mode public.resonance_mode not null default 'similar',
  stage_mode public.resonance_mode not null default 'different',
  theme_mode public.resonance_mode not null default 'similar',
  updated_at timestamptz not null default now()
);

create table public.algorithm_configs (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  status public.config_status not null default 'draft',
  weights jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint algorithm_weights_shape check (
    weights ?& array['city', 'life', 'theme', 'semantic', 'age', 'stage', 'gender']
  )
);

create table public.recommendation_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reference_story_id uuid references public.stories(id) on delete set null,
  algorithm_config_id uuid not null references public.algorithm_configs(id),
  formula_version text not null default 'storyverse-recommendation-v1',
  city_mode public.resonance_mode not null,
  stage_mode public.resonance_mode not null,
  theme_mode public.resonance_mode not null,
  created_at timestamptz not null default now()
);
create index recommendation_batches_user_idx on public.recommendation_batches(user_id, created_at desc);

create table public.recommendation_results (
  batch_id uuid not null references public.recommendation_batches(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  rank smallint not null,
  city_score double precision not null,
  life_score double precision not null,
  theme_score double precision not null,
  semantic_score double precision not null,
  final_score double precision not null,
  primary key (batch_id, story_id),
  unique (batch_id, rank)
);

create table public.generated_images (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  style public.image_style not null,
  status public.image_status not null default 'queued',
  prompt text not null,
  highlight jsonb not null default '{}'::jsonb,
  storage_path text,
  public_url text,
  model text not null,
  model_version text not null,
  source_content_hash text not null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index generated_images_rate_idx on public.generated_images(user_id, created_at desc);
create index generated_images_story_idx on public.generated_images(story_id, created_at desc);

create table public.reactions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  value public.reaction_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  reason text not null,
  note text not null default '',
  review_case_id uuid references public.review_cases(id) on delete set null,
  created_at timestamptz not null default now()
);
create index reports_story_idx on public.reports(story_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid references public.stories(id) on delete cascade,
  review_case_id uuid references public.review_cases(id) on delete cascade,
  status public.notification_status not null default 'pending',
  kind public.notification_kind not null,
  story_title text not null,
  reason text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read, created_at desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.import_failures (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  external_id text,
  raw_data jsonb not null,
  error text not null,
  created_at timestamptz not null default now()
);

create table public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  task_type text not null check (task_type in ('story_analysis', 'theme_embedding', 'image_generation')),
  status public.ai_task_status not null default 'queued',
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index ai_tasks_queue_idx on public.ai_tasks(status, next_attempt_at, created_at);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger account_credentials_set_updated_at before update on public.account_credentials
for each row execute function public.set_updated_at();
create trigger story_types_set_updated_at before update on public.story_types
for each row execute function public.set_updated_at();
create trigger story_drafts_set_updated_at before update on public.story_drafts
for each row execute function public.set_updated_at();
create trigger stories_set_updated_at before update on public.stories
for each row execute function public.set_updated_at();
create trigger review_cases_set_updated_at before update on public.review_cases
for each row execute function public.set_updated_at();
create trigger resonance_preferences_set_updated_at before update on public.resonance_preferences
for each row execute function public.set_updated_at();
create trigger reactions_set_updated_at before update on public.reactions
for each row execute function public.set_updated_at();
create trigger ai_tasks_set_updated_at before update on public.ai_tasks
for each row execute function public.set_updated_at();

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and status = 'active'
  );
$$;

create or replace function public.stage_index(value text)
returns double precision
language sql
immutable
as $$
  select case value
    when '学龄期' then 0
    when '青春期' then 1
    when '成年早期' then 2
    when '成年中期' then 3
    when '老年期' then 4
    else 2
  end::double precision;
$$;

create or replace function public.haversine_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql
immutable
strict
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

insert into public.story_types (id, parent_type, label_zh, label_en, color, sort_order) values
  ('interpersonal_conflict', 'relationship', '冲突', 'Interpersonal conflict', '#FF6B8A', 1),
  ('break_up', 'relationship', '分离', 'Break-up', '#C77DFF', 2),
  ('parenthood', 'relationship', '为人父母', 'Parenthood', '#FF9FBD', 3),
  ('relationship_building', 'relationship', '亲密关系建立', 'Relationship-building', '#F472D0', 4),
  ('other_relationship', 'relationship', '其他关系', 'Other relationship event', '#9B8AFB', 5),
  ('death', 'mortality', '死亡', 'Death', '#8F9CFF', 6),
  ('serious_illness', 'mortality', '疾病', 'Serious illness', '#56B4E9', 7),
  ('accident_or_injury', 'mortality', '意外', 'Accident or injury', '#FF8A5B', 8),
  ('addiction', 'mortality', '成瘾', 'Addiction', '#B66DFF', 9),
  ('other_life_threatening', 'mortality', '其他生命威胁', 'Other life-threatening event', '#FFBD69', 10),
  ('career_setback', 'career', '事业挫折', 'Career setback', '#D99B00', 11),
  ('career_achievement', 'career', '事业高光', 'Career achievement', '#F2C94C', 12),
  ('mentorship', 'learning', '师友', 'Mentorship', '#4CC9F0', 13),
  ('formal_education', 'learning', '求学', 'Formal education', '#48CAE4', 14),
  ('self_directed_learning', 'learning', '自学', 'Self-directed learning', '#2EC4B6', 15),
  ('school_transgression', 'learning', '校园违规', 'School transgression', '#4361EE', 16),
  ('other_learning', 'learning', '其他学习经历', 'Other learning experience', '#72D6C9', 17),
  ('recreation_or_travel', 'recreation', '娱乐休闲', 'Recreation or short-term travel', '#36D399', 18),
  ('relocation_or_immigration', 'relocation', '迁移', 'Relocation or immigration', '#74C365', 19),
  ('religious_or_spiritual', 'spiritual', '精神', 'Religious or spiritual event', '#BFA2DB', 20),
  ('other_or_unclassifiable', 'other', '其他', 'Other or unclassifiable', '#C7CEDB', 21);

insert into public.algorithm_configs (version, status, weights, published_at) values (
  1,
  'published',
  '{"city":0.15,"life":0.25,"theme":0.25,"semantic":0.35,"age":0.50,"stage":0.30,"gender":0.20}'::jsonb,
  now()
);

do $$
begin
  perform pgmq.create('story_analysis');
exception
  when duplicate_table or unique_violation then null;
end;
$$;

create or replace function public.queue_story_analysis(p_story_id uuid, p_task_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  message_id bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if not exists (
    select 1 from public.ai_tasks where id = p_task_id and story_id = p_story_id
  ) then raise exception 'story task does not match'; end if;
  select pgmq.send('story_analysis', jsonb_build_object('story_id', p_story_id, 'task_id', p_task_id))
    into message_id;
  return message_id;
end;
$$;

create or replace function public.claim_story_analysis()
returns table (msg_id bigint, message jsonb)
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  return query select item.msg_id, item.message from pgmq.read('story_analysis', 90, 1) item;
end;
$$;

create or replace function public.archive_story_analysis(p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare archived boolean;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select pgmq.archive('story_analysis', p_msg_id) into archived;
  return archived;
end;
$$;

create or replace function public.refresh_recommendations(p_limit integer default 100)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  reference_story public.stories%rowtype;
  reference_embedding public.story_embeddings%rowtype;
  preference public.resonance_preferences%rowtype;
  config public.algorithm_configs%rowtype;
  batch_id uuid;
  result_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
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
  join public.story_embeddings e on e.story_id = s.id and e.story_embedding is not null and e.theme_embedding is not null
  where s.user_id = current_user_id and s.status = 'published'
  order by s.published_at desc nulls last, s.created_at desc
  limit 1;

  if found then select * into reference_embedding from public.story_embeddings where story_id = reference_story.id; end if;

  insert into public.recommendation_batches(
    user_id, reference_story_id, algorithm_config_id, formula_version, city_mode, stage_mode, theme_mode
  ) values (
    current_user_id, reference_story.id, config.id, 'storyverse-recommendation-v1',
    preference.city_mode, preference.stage_mode, preference.theme_mode
  ) returning id into batch_id;

  if reference_story.id is null then return batch_id; end if;

  insert into public.recommendation_results(
    batch_id, story_id, rank, city_score, life_score, theme_score, semantic_score, final_score
  )
  with raw_scores as (
    select
      s.id as story_id,
      case
        when reference_story.latitude is null or reference_story.longitude is null or s.latitude is null or s.longitude is null then 0.5
        else 1.0 / (1.0 + public.haversine_km(reference_story.latitude, reference_story.longitude, s.latitude, s.longitude) / 500.0)
      end as city_score,
      (
        greatest(0.0, least(1.0, 1.0 - abs(reference_story.age - s.age)::double precision / 60.0)) * (config.weights->>'age')::double precision +
        greatest(0.0, least(1.0, 1.0 - abs(public.stage_index(reference_story.life_stage) - public.stage_index(s.life_stage)) / 4.0)) * (config.weights->>'stage')::double precision +
        case when reference_story.gender = s.gender then 1.0 else 0.0 end * (config.weights->>'gender')::double precision
      ) as life_score,
      greatest(0.0, least(1.0, 1.0 - (reference_embedding.theme_embedding <=> e.theme_embedding))) as theme_score,
      greatest(0.0, least(1.0, 1.0 - (reference_embedding.story_embedding <=> e.story_embedding))) as semantic_score
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
      city_score * (config.weights->>'city')::double precision +
      life_score * (config.weights->>'life')::double precision +
      theme_score * (config.weights->>'theme')::double precision +
      semantic_score * (config.weights->>'semantic')::double precision as final_score
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-images', 'story-images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.account_credentials enable row level security;
alter table public.story_types enable row level security;
alter table public.story_drafts enable row level security;
alter table public.stories enable row level security;
alter table public.story_versions enable row level security;
alter table public.moderation_results enable row level security;
alter table public.review_cases enable row level security;
alter table public.story_embeddings enable row level security;
alter table public.resonance_preferences enable row level security;
alter table public.algorithm_configs enable row level security;
alter table public.recommendation_batches enable row level security;
alter table public.recommendation_results enable row level security;
alter table public.generated_images enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.feedback enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_failures enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (
  (id = auth.uid() and public.is_active_user()) or public.is_admin()
) with check ((id = auth.uid() and public.is_active_user()) or public.is_admin());
create policy story_types_read on public.story_types for select using (true);
create policy story_types_admin on public.story_types for all using (public.is_admin()) with check (public.is_admin());
create policy drafts_owner on public.story_drafts for all using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
) with check ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());
create policy stories_read on public.stories for select using (
  status = 'published' or (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy story_versions_read on public.story_versions for select using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy moderation_results_read on public.moderation_results for select using (
  public.is_admin() or (public.is_active_user() and exists (
    select 1 from public.stories where stories.id = moderation_results.story_id and stories.user_id = auth.uid()
  ))
);
create policy review_cases_read on public.review_cases for select using (
  (author_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy review_cases_admin on public.review_cases for all using (public.is_admin()) with check (public.is_admin());
create policy embeddings_owner_read on public.story_embeddings for select using (
  public.is_admin() or (public.is_active_user() and exists (
    select 1 from public.stories where stories.id = story_embeddings.story_id and stories.user_id = auth.uid()
  ))
);
create policy resonance_owner on public.resonance_preferences for all using (
  user_id = auth.uid() and public.is_active_user()
) with check (user_id = auth.uid() and public.is_active_user());
create policy algorithm_config_read on public.algorithm_configs for select using (status = 'published' or public.is_admin());
create policy algorithm_config_admin on public.algorithm_configs for all using (public.is_admin()) with check (public.is_admin());
create policy recommendation_batches_owner on public.recommendation_batches for select using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy recommendation_results_owner on public.recommendation_results for select using (
  public.is_admin() or (public.is_active_user() and exists (
    select 1 from public.recommendation_batches b where b.id = recommendation_results.batch_id and b.user_id = auth.uid()
  ))
);
create policy generated_images_read on public.generated_images for select using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin() or exists (
    select 1 from public.stories where stories.id = generated_images.story_id and stories.status = 'published'
  )
);
create policy reactions_owner on public.reactions for all using (
  user_id = auth.uid() and public.is_active_user()
) with check (user_id = auth.uid() and public.is_active_user());
create policy reports_owner_insert on public.reports for insert with check (
  reporter_id = auth.uid() and public.is_active_user()
);
create policy reports_owner_select on public.reports for select using (
  (reporter_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy notifications_owner on public.notifications for select using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy notifications_owner_update on public.notifications for update using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
) with check ((user_id = auth.uid() and public.is_active_user()) or public.is_admin());
create policy feedback_owner_insert on public.feedback for insert with check (
  user_id = auth.uid() and public.is_active_user()
);
create policy feedback_owner_select on public.feedback for select using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy import_batches_admin on public.import_batches for all using (public.is_admin()) with check (public.is_admin());
create policy import_failures_admin on public.import_failures for all using (public.is_admin()) with check (public.is_admin());
create policy ai_tasks_read on public.ai_tasks for select using (
  (user_id = auth.uid() and public.is_active_user()) or public.is_admin()
);
create policy audit_admin on public.admin_audit_logs for select using (public.is_admin());

create policy story_images_public_read on storage.objects for select
using (bucket_id = 'story-images');

revoke all on public.account_credentials from anon, authenticated;
revoke all on public.story_embeddings from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.story_types, public.stories to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant all on public.story_drafts, public.resonance_preferences, public.reactions to authenticated;
grant select on public.story_versions, public.moderation_results, public.review_cases,
  public.algorithm_configs, public.recommendation_batches, public.recommendation_results,
  public.generated_images, public.notifications, public.ai_tasks to authenticated;
grant insert, select on public.reports, public.feedback to authenticated;
grant update (read) on public.notifications to authenticated;
grant execute on function public.is_admin(uuid), public.is_active_user(uuid), public.refresh_recommendations(integer) to authenticated;
revoke all on function public.queue_story_analysis(uuid, uuid), public.claim_story_analysis(), public.archive_story_analysis(bigint) from public, anon, authenticated;
grant execute on function public.queue_story_analysis(uuid, uuid), public.claim_story_analysis(), public.archive_story_analysis(bigint) to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
