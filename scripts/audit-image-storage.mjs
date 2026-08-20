import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { imageDimensions } from "./lib/image-dimensions.mjs";

const EXPECTED_PROJECT_REF = "zgyrbtdyraxglxhbkazp";
const mode = process.argv[2] ?? "local";
const removeOrphans = process.argv.includes("--remove-orphans");

function parseJsonOutput(output, commandName) {
  const objectStart = output.indexOf("{");
  const arrayStart = output.indexOf("[");
  const jsonStart = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
  if (jsonStart < 0) throw new Error(`${commandName} did not return JSON.`);
  return JSON.parse(output.slice(jsonStart));
}

function runSupabase(args) {
  const result = spawnSync("npx", ["supabase", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || `supabase ${args.join(" ")} failed.`);
  return parseJsonOutput(result.stdout, `supabase ${args.join(" ")}`);
}

async function resolveConfig() {
  if (mode === "local") {
    const status = runSupabase(["status", "--output", "json"]);
    const url = String(status.API_URL ?? "");
    const key = String(status.SECRET_KEY ?? "");
    if (!url.startsWith("http://127.0.0.1:") || !key) throw new Error("Local Supabase is not running.");
    return { target: "local", url, key };
  }
  if (mode !== "online") throw new Error("Usage: node scripts/audit-image-storage.mjs [local|online]");
  const linkedProjectRef = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
  if (linkedProjectRef !== EXPECTED_PROJECT_REF) {
    throw new Error(`Refusing online audit: linked project is ${linkedProjectRef || "missing"}.`);
  }
  const payload = runSupabase([
    "projects",
    "api-keys",
    "--project-ref",
    EXPECTED_PROJECT_REF,
    "--reveal",
    "--output",
    "json",
  ]);
  const keys = Array.isArray(payload) ? payload : (payload.api_keys ?? payload.keys ?? []);
  const secret = keys.find((item) => item.type === "secret") ?? keys.find((item) => item.name === "service_role");
  const key = String(secret?.api_key ?? secret?.key ?? "");
  if (!key) throw new Error("Could not resolve the online service key.");
  return { target: EXPECTED_PROJECT_REF, url: `https://${EXPECTED_PROJECT_REF}.supabase.co`, key };
}

async function listFiles(storage, prefix = "") {
  const { data, error } = await storage.list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  const paths = [];
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) paths.push(path);
    else paths.push(...(await listFiles(storage, path)));
  }
  return paths;
}

const config = await resolveConfig();
const client = createClient(config.url, config.key, { auth: { autoRefreshToken: false, persistSession: false } });
const [{ count: storyCount, error: storyCountError }, { count: seedStoryCount, error: seedStoryCountError }] =
  await Promise.all([
    client.from("stories").select("id", { count: "exact", head: true }),
    client.from("stories").select("id", { count: "exact", head: true }).eq("source_kind", "seed"),
  ]);
if (storyCountError || seedStoryCountError) throw storyCountError ?? seedStoryCountError;
const { data: records, error } = await client
  .from("generated_images")
  .select("id,story_id,status,storage_path,public_url,created_at,story:stories(status)")
  .order("created_at", { ascending: false });
if (error) throw error;

const rows = records ?? [];
const storyCounts = new Map();
for (const row of rows) storyCounts.set(row.story_id, (storyCounts.get(row.story_id) ?? 0) + 1);
const duplicateStories = [...storyCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([storyId, count]) => ({ storyId, count }));
const files = await listFiles(client.storage.from("story-images"));
const referencedPaths = new Set(rows.map((row) => row.storage_path).filter(Boolean));
const missingFiles = [...referencedPaths].filter((path) => !files.includes(path));
const orphanFiles = files.filter((path) => !referencedPaths.has(path));
const publicImageChecks = await Promise.all(
  rows
    .filter((row) => row.status === "ready")
    .map(async (row) => {
      try {
        const response = await fetch(row.public_url);
        if (!response.ok) return { id: row.id, readable: false, square: false };
        const dimensions = imageDimensions(await response.arrayBuffer());
        return { id: row.id, readable: true, square: dimensions.width === dimensions.height };
      } catch {
        return { id: row.id, readable: false, square: false };
      }
    }),
);
if (removeOrphans && orphanFiles.length) {
  const { error: removeError } = await client.storage.from("story-images").remove(orphanFiles);
  if (removeError) throw removeError;
}
const statusCounts = Object.fromEntries(
  [...new Set(rows.map((row) => row.status))].map((status) => [
    status,
    rows.filter((row) => row.status === status).length,
  ]),
);

process.stdout.write(
  `${JSON.stringify(
    {
      target: config.target,
      stories: storyCount ?? 0,
      seedStories: seedStoryCount ?? 0,
      records: rows.length,
      storiesWithImages: storyCounts.size,
      statusCounts,
      duplicateStories,
      storageFiles: files.length,
      missingFiles,
      orphanFiles,
      unreadablePublicImages: publicImageChecks.filter((item) => !item.readable).map((item) => item.id),
      nonSquarePublicImages: publicImageChecks.filter((item) => item.readable && !item.square).map((item) => item.id),
      imagesOnNonPublishedStories: rows
        .filter((row) => {
          const story = Array.isArray(row.story) ? row.story[0] : row.story;
          return story?.status !== "published";
        })
        .map((row) => row.id),
      removedOrphanFiles: removeOrphans ? orphanFiles.length : 0,
    },
    null,
    2,
  )}\n`,
);
