CREATE ROLE storyverse_app LOGIN PASSWORD 'local-app-only';
GRANT CONNECT ON DATABASE storyverse TO storyverse_app;
