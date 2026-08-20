create table public.story_translations (
  story_id uuid not null references public.stories(id) on delete cascade,
  target_language text not null check (target_language in ('en')),
  source_hash text not null,
  title text not null,
  excerpt text not null,
  body text not null,
  themes text[] not null default '{}',
  mood text not null default '',
  life_stage text not null default '',
  people text[] not null default '{}',
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (story_id, target_language)
);

create trigger story_translations_set_updated_at before update on public.story_translations
for each row execute function public.set_updated_at();

alter table public.story_translations enable row level security;

create policy story_translations_read on public.story_translations for select using (
  (select private.is_admin())
  or exists (
    select 1
    from public.stories
    where stories.id = story_translations.story_id
      and (
        stories.status = 'published'
        or (stories.user_id = (select auth.uid()) and (select private.is_active_user()))
      )
  )
);

grant select on public.story_translations to authenticated;
grant all privileges on public.story_translations to service_role;

create or replace function public.reject_own_story_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.stories
    where stories.id = new.story_id and stories.user_id = new.user_id
  ) then
    raise exception using errcode = '42501', message = 'SELF_REACTION_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

create or replace function public.reject_own_story_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.stories
    where stories.id = new.story_id and stories.user_id = new.reporter_id
  ) then
    raise exception using errcode = '42501', message = 'SELF_REPORT_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

create trigger reactions_reject_story_owner
before insert or update on public.reactions
for each row execute function public.reject_own_story_reaction();

create trigger reports_reject_story_owner
before insert or update on public.reports
for each row execute function public.reject_own_story_report();

revoke all on function public.reject_own_story_reaction(), public.reject_own_story_report()
from public, anon, authenticated;
