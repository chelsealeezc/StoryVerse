CREATE TABLE IF NOT EXISTS "generated_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "story_id" uuid REFERENCES "stories"("id") ON DELETE SET NULL,
  "style" text NOT NULL,
  "prompt" text NOT NULL,
  "highlight" jsonb NOT NULL,
  "provider_url" text,
  "expires_at" timestamptz,
  "status" job_status NOT NULL DEFAULT 'pending',
  "model" text NOT NULL,
  "failure_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storyverse_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON generated_images TO storyverse_app;
  END IF;
END $$;
