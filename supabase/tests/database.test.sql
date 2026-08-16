begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'stories', 'stories table exists');
select has_table('public', 'story_embeddings', 'story embeddings table exists');
select has_table('public', 'review_cases', 'human review table exists');
select has_table('public', 'recommendation_batches', 'recommendation batches table exists');
select has_table('public', 'recommendation_results', 'recommendation results table exists');
select has_table('public', 'admin_audit_logs', 'admin audit log exists');

select is((select count(*)::integer from public.story_types), 21, 'exactly 21 story types are seeded');
select is((select count(*)::integer from public.algorithm_configs where status = 'published'), 1, 'one default algorithm version is published');
select is(public.stage_index('学龄期'), 0::double precision, 'school age is the first life-stage index');
select is(public.stage_index('老年期'), 4::double precision, 'old age is the final life-stage index');
select ok(public.haversine_km(39.9042, 116.4074, 39.9042, 116.4074) < 0.001, 'same-city distance is zero');
select ok(public.haversine_km(39.9042, 116.4074, 31.2304, 121.4737) between 1000 and 1200, 'Beijing-Shanghai distance is plausible');

select policies_are('public', 'stories', array['stories_read'], 'stories expose only the explicit read policy');
select policies_are('public', 'account_credentials', array[]::text[], 'security answers have no user-facing policies');
select policies_are('public', 'admin_audit_logs', array['audit_admin'], 'audit records are admin-only');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000998'),
  ('00000000-0000-0000-0000-000000000999'),
  ('00000000-0000-0000-0000-000000000997');

insert into public.profiles (id, username, display_name, anonymous_number) values
  ('00000000-0000-0000-0000-000000000999', 'reference_user', '参照用户', 999),
  ('00000000-0000-0000-0000-000000000998', 'candidate_user', '候选用户', 998),
  ('00000000-0000-0000-0000-000000000997', 'private_user', '私密用户', 997);

insert into public.stories (
  id, user_id, author_display_name, title, body, mood, life_stage, age, gender, city,
  latitude, longitude, people, status, moderation_decision, final_type_id, final_themes,
  content_hash, published_at
) values (
  '10000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000999',
  '参照用户', '参照故事', repeat('字', 100), '平和自足', '成年早期', 30, '女', '原点城',
  0, 0, array['自己'], 'published', 'pass', 'career_achievement', array['职业成长', '自我肯定'],
  'reference-hash', now()
), (
  '20000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000997',
  '私密用户', '不公开故事', repeat('字', 100), '平和自足', '成年早期', 30, '女', '原点城',
  0, 0, array['自己'], 'private', 'pass', 'career_achievement', array['职业成长', '自我肯定'],
  'private-hash', null
);

insert into public.stories (
  id, user_id, author_display_name, title, body, mood, life_stage, age, gender, city,
  latitude, longitude, people, status, moderation_decision, final_type_id, final_themes,
  content_hash, published_at
)
select
  ('30000000-0000-0000-0000-' || lpad(series::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000998'::uuid,
  '候选用户', '候选故事 ' || series, repeat('字', 100), '平和自足', '成年早期', 30, '女', '候选城',
  0, series, array['自己'], 'published', 'pass', 'career_achievement', array['职业成长', '自我肯定'],
  'candidate-' || series, now()
from generate_series(1, 101) series;

insert into public.story_embeddings (
  story_id, story_embedding, theme_embedding, model, model_version, content_hash, theme_hash
)
select
  story.id,
  ('[' || array_to_string(array_fill(1.0, array[1024]), ',') || ']')::extensions.vector(1024),
  ('[' || array_to_string(array_fill(1.0, array[1024]), ',') || ']')::extensions.vector(1024),
  'test-embedding', 'v1', story.content_hash, 'same-theme'
from public.stories story
where story.status = 'published';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000999', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
create temporary table test_batch as select public.refresh_recommendations(100) as id;

select is(
  (select count(*)::integer from public.recommendation_results where batch_id = (select id from test_batch)),
  100,
  'recommendation batches are capped at Top 100'
);
select is(
  (select formula_version from public.recommendation_batches where id = (select id from test_batch)),
  'storyverse-recommendation-v1',
  'recommendation batches preserve the formula version'
);
select is(
  (select story_id from public.recommendation_results where batch_id = (select id from test_batch) and rank = 1),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'fixed inputs produce the expected first-ranked story'
);
select is(
  (select semantic_score from public.recommendation_results where batch_id = (select id from test_batch) and rank = 1),
  1::double precision,
  'identical content vectors produce semantic score 1'
);
select ok(
  (select bool_and(final_score >= lead_score) from (
    select final_score, lead(final_score) over (order by rank) as lead_score
    from public.recommendation_results where batch_id = (select id from test_batch)
  ) scores where lead_score is not null),
  'recommendation rows are deterministically sorted by descending score'
);
select is(
  (select count(*)::integer from public.recommendation_results result
    join public.stories story on story.id = result.story_id
    where result.batch_id = (select id from test_batch) and story.user_id = '00000000-0000-0000-0000-000000000999'),
  0,
  'a user never recommends their own story'
);

set local role authenticated;
select is((select count(*)::integer from public.stories), 102, 'RLS exposes published stories and the current user own story only');
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000999'$$,
  '42501',
  'permission denied for table profiles',
  'ordinary users cannot promote themselves to admin'
);
reset role;

update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-000000000997';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000997', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.stories where id = '20000000-0000-0000-0000-000000000000'),
  0,
  'a suspended account cannot read its private story through RLS'
);
reset role;

select * from finish();
rollback;
