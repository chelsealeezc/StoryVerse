import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_MIGRATOR_URL || "postgresql://storyverse_migrator:password@127.0.0.1:5432/storyverse" },
  strict: true,
});
