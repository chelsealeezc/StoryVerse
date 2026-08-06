import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;

function sslConfig(url: string) {
  if (!url || /localhost|127\.0\.0\.1/.test(url)) return undefined;
  return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" };
}

export function createPool(url = process.env.DATABASE_URL) {
  if (!url) return null;
  return new Pool({
    connectionString: url,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: sslConfig(url),
    application_name: "storyverse-api",
  });
}

export type DatabasePool = ReturnType<typeof createPool>;

export async function runMigrations() {
  const url = process.env.DATABASE_MIGRATOR_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") throw new Error("DATABASE_MIGRATOR_URL is required in production");
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000, ssl: sslConfig(url) });
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [728_406_221]);
    await migrate(drizzle(client), { migrationsFolder: process.env.MIGRATIONS_DIR || "drizzle" });
  } finally {
    await client.query("select pg_advisory_unlock($1)", [728_406_221]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}
