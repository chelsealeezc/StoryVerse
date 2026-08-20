-- Run this once in the remote Supabase SQL Editor after deploying story-analysis-worker.
-- Replace the two placeholders first. Vault encrypts them; do not commit real values here.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'storyverse_project_url');
select vault.create_secret('YOUR_WORKER_TOKEN', 'storyverse_worker_token');

select cron.schedule(
  'storyverse-story-analysis-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'storyverse_project_url')
      || '/functions/v1/story-analysis-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-storyverse-worker-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'storyverse_worker_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  );
  $$
);

-- To remove the schedule later:
-- select cron.unschedule('storyverse-story-analysis-worker');
