alter table public.account_credentials
  add constraint account_credentials_security_question
  check (security_question in ('first_school', 'childhood_place', 'first_pet'));

alter table public.stories
  add constraint stories_gender_allowed
  check (gender in ('男', '女', '其他'));

alter table public.story_drafts
  add constraint story_drafts_gender_allowed
  check (gender = '' or gender in ('男', '女', '其他'));
