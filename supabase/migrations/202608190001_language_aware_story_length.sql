-- User stories keep the 100–1500 limit. Non-CJK text is measured by words,
-- while CJK text is measured by characters. Authorised seed stories may keep
-- longer source material without weakening the user-facing limit.
--
-- Two stories created before this rule was introduced passed the former raw
-- character check but contain 97/99 CJK characters after punctuation is
-- excluded. Preserve those existing records; all stories created from the
-- migration date onward use the language-aware rule. Application validation
-- remains authoritative when an older story is edited.

alter table public.stories drop constraint if exists stories_body_length;

alter table public.stories
  add constraint stories_body_length check (
    case
      when created_at < timestamptz '2026-08-19 00:00:00+00' then
        true
      when source_kind = 'seed' then
        char_length(btrim(body)) between 100 and 20000
      when btrim(body) ~ '[一-龥ぁ-んァ-ヶ가-힣]' then
        char_length(regexp_replace(btrim(body), '[^一-龥ぁ-んァ-ヶ가-힣]', '', 'g')) between 100 and 1500
      else
        cardinality(regexp_split_to_array(btrim(body), E'\\s+')) between 100 and 1500
        and char_length(btrim(body)) <= 20000
    end
  );
