create or replace function public.invalidate_story_translation_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.title is distinct from new.title
    or old.ai_suggested_title is distinct from new.ai_suggested_title
    or old.excerpt is distinct from new.excerpt
    or old.body is distinct from new.body
    or old.final_themes is distinct from new.final_themes
    or old.mood is distinct from new.mood
    or old.life_stage is distinct from new.life_stage
    or old.people is distinct from new.people
    or old.city is distinct from new.city
  then
    delete from public.story_translations where story_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists stories_invalidate_translation_cache on public.stories;
create trigger stories_invalidate_translation_cache
after update of title, ai_suggested_title, excerpt, body, final_themes, mood, life_stage, people, city
on public.stories
for each row execute function public.invalidate_story_translation_cache();

revoke all on function public.invalidate_story_translation_cache() from public, anon, authenticated;
