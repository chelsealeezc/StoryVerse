ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE drafts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE stories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE story_tags ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE story_analyses ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE recommendation_batches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE recommendation_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE reactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE reports ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE analytics_events ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE generated_images ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE drafts
  ALTER COLUMN age DROP DEFAULT,
  ALTER COLUMN age TYPE text USING age::text,
  ALTER COLUMN age SET DEFAULT '';

ALTER TABLE drafts
  ALTER COLUMN people DROP DEFAULT,
  ALTER COLUMN people TYPE jsonb USING to_jsonb(people),
  ALTER COLUMN people SET DEFAULT '[]'::jsonb;
