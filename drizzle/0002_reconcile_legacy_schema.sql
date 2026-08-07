-- Reconcile the legacy StoryVerse schema that existed before the current API.
-- Every change is additive or a lossless column rename so the migration is safe
-- both for the legacy RDS database and for a database created from 0000.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_visibility') THEN
    CREATE TYPE story_visibility AS ENUM ('public', 'private');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status') THEN
    CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_value') THEN
    CREATE TYPE reaction_value AS ENUM ('like', 'dislike');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS anonymous_number integer GENERATED ALWAYS AS IDENTITY;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'last_seen_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE sessions RENAME COLUMN last_seen_at TO last_used_at;
  END IF;
END $$;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drafts' AND column_name = 'occurred_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drafts' AND column_name = 'occurred_at'
  ) THEN
    ALTER TABLE drafts RENAME COLUMN occurred_time TO occurred_at;
  END IF;
END $$;

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS occurred_at text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_current boolean;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC) AS position
  FROM drafts
)
UPDATE drafts AS draft
SET is_current = (ranked.position = 1)
FROM ranked
WHERE draft.id = ranked.id AND draft.is_current IS NULL;

ALTER TABLE drafts
  ALTER COLUMN is_current SET DEFAULT true,
  ALTER COLUMN is_current SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS drafts_one_current_per_user
  ON drafts (user_id) WHERE is_current;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE stories RENAME COLUMN owner_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'anonymous_alias'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'anonymous_author'
  ) THEN
    ALTER TABLE stories RENAME COLUMN anonymous_alias TO anonymous_author;
  END IF;
END $$;

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS visibility story_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS moderation_status moderation_status NOT NULL DEFAULT 'approved';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'status'
  ) THEN
    EXECUTE $sql$
      UPDATE stories
      SET visibility = CASE WHEN status::text = 'public' THEN 'public'::story_visibility ELSE 'private'::story_visibility END,
          moderation_status = CASE
            WHEN status::text = 'deleted' THEN 'rejected'::moderation_status
            WHEN status::text = 'hidden' THEN 'pending'::moderation_status
            ELSE 'approved'::moderation_status
          END
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stories_feed_idx
  ON stories (visibility, moderation_status, published_at);
CREATE INDEX IF NOT EXISTS stories_user_idx ON stories (user_id);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'story_analyses' AND column_name = 'arc'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'story_analyses' AND column_name = 'narrative_arc'
  ) THEN
    ALTER TABLE story_analyses RENAME COLUMN arc TO narrative_arc;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'story_analyses' AND column_name = 'error_code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'story_analyses' AND column_name = 'failure_reason'
  ) THEN
    ALTER TABLE story_analyses RENAME COLUMN error_code TO failure_reason;
  END IF;
END $$;

ALTER TABLE story_analyses
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS story_id uuid,
  ADD COLUMN IF NOT EXISTS narrative_arc jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS failure_reason text;

UPDATE story_analyses AS analysis
SET user_id = draft.user_id
FROM drafts AS draft
WHERE analysis.user_id IS NULL AND analysis.draft_id = draft.id;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'story_analyses_user_id_users_id_fk') THEN
    ALTER TABLE story_analyses
      ADD CONSTRAINT story_analyses_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'story_analyses_story_id_stories_id_fk') THEN
    ALTER TABLE story_analyses
      ADD CONSTRAINT story_analyses_story_id_stories_id_fk
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE recommendation_batches
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reactions' AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reactions' AND column_name = 'value'
  ) THEN
    ALTER TABLE reactions RENAME COLUMN type TO value;
  END IF;
END $$;

ALTER TABLE reactions
  ADD COLUMN IF NOT EXISTS value reaction_value;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'event_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'name'
  ) THEN
    ALTER TABLE analytics_events RENAME COLUMN event_name TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'payload'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'properties'
  ) THEN
    ALTER TABLE analytics_events RENAME COLUMN payload TO properties;
  END IF;
END $$;

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS properties jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storyverse_app') THEN
    GRANT USAGE ON SCHEMA public TO storyverse_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO storyverse_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO storyverse_app;
  END IF;
END $$;
