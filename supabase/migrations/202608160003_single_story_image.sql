-- A story has one selected image. Failed/retried model calls are tracked separately
-- so they cannot create extra final image rows or bypass the hourly limit.

create table public.image_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  style public.image_style not null,
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index image_generation_attempts_rate_idx
  on public.image_generation_attempts(user_id, created_at desc);

alter table public.image_generation_attempts enable row level security;
revoke all on public.image_generation_attempts from public, anon, authenticated;
grant all on public.image_generation_attempts to service_role;

-- Keep the newest successful image when legacy data contains more than one row.
-- A deployment preflight removes any discarded Storage objects before this runs.
with ranked_images as (
  select
    id,
    row_number() over (
      partition by story_id
      order by
        case status when 'ready' then 0 when 'generating' then 1 else 2 end,
        created_at desc,
        id desc
    ) as position
  from public.generated_images
)
delete from public.generated_images image
using ranked_images ranked
where image.id = ranked.id
  and ranked.position > 1;

create unique index generated_images_one_per_story_idx
  on public.generated_images(story_id);

create or replace function public.claim_story_image_generation(
  p_story_id uuid,
  p_user_id uuid,
  p_style public.image_style,
  p_prompt text,
  p_highlight jsonb,
  p_model text,
  p_source_content_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_image public.generated_images%rowtype;
  claimed_image_id uuid;
  attempt_id uuid;
  recent_attempt_count integer;
begin
  -- Serialize requests per account so concurrent calls cannot bypass the rate limit.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into current_image
  from public.generated_images
  where story_id = p_story_id
  for update;

  if found and current_image.status = 'ready' then
    if current_image.source_content_hash <> p_source_content_hash then
      return jsonb_build_object(
        'outcome', 'stale',
        'imageId', current_image.id,
        'storagePath', current_image.storage_path
      );
    end if;
    if current_image.style = p_style then
      return jsonb_build_object(
        'outcome', 'ready',
        'imageId', current_image.id,
        'imageUrl', current_image.public_url,
        'style', current_image.style,
        'highlight', current_image.highlight,
        'prompt', current_image.prompt
      );
    end if;
    return jsonb_build_object(
      'outcome', 'ready',
      'imageId', current_image.id,
      'imageUrl', current_image.public_url,
      'style', current_image.style,
      'highlight', current_image.highlight,
      'prompt', current_image.prompt
    );
  end if;

  if found
    and current_image.status = 'generating'
    and current_image.created_at > now() - interval '15 minutes'
  then
    return jsonb_build_object('outcome', 'generating', 'imageId', current_image.id);
  end if;

  select count(*)::integer
  into recent_attempt_count
  from public.image_generation_attempts
  where user_id = p_user_id
    and created_at >= now() - interval '1 hour';

  if recent_attempt_count >= 5 then
    return jsonb_build_object('outcome', 'rate_limited');
  end if;

  insert into public.image_generation_attempts (story_id, user_id, style)
  values (p_story_id, p_user_id, p_style)
  returning id into attempt_id;

  if current_image.id is null then
    insert into public.generated_images (
      story_id, user_id, style, status, prompt, highlight, model, model_version,
      source_content_hash, created_at, completed_at, storage_path, public_url, error
    ) values (
      p_story_id, p_user_id, p_style, 'generating', p_prompt, p_highlight, p_model, p_model,
      p_source_content_hash, now(), null, null, null, null
    )
    returning id into claimed_image_id;
  else
    update public.generated_images
    set
      user_id = p_user_id,
      style = p_style,
      status = 'generating',
      prompt = p_prompt,
      highlight = p_highlight,
      model = p_model,
      model_version = p_model,
      source_content_hash = p_source_content_hash,
      storage_path = null,
      public_url = null,
      error = null,
      created_at = now(),
      completed_at = null
    where id = current_image.id
    returning id into claimed_image_id;
  end if;

  return jsonb_build_object(
    'outcome', 'claimed',
    'imageId', claimed_image_id,
    'attemptId', attempt_id
  );
end;
$$;

revoke all on function public.claim_story_image_generation(
  uuid, uuid, public.image_style, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.claim_story_image_generation(
  uuid, uuid, public.image_style, text, jsonb, text, text
) to service_role;
