import { buildApp } from "./app.js";
import { runMigrations } from "./db.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);

async function start() {
  await runMigrations();
  const app = await buildApp();
  await app.listen({ port, host: "0.0.0.0" });
}

start().catch(error => {
  console.error("StoryVerse API failed to start", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
