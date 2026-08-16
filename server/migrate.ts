import { runMigrations } from "./db.js";

runMigrations().catch(error => {
  console.error("Migration failed", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
