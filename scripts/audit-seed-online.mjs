import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "zgyrbtdyraxglxhbkazp";
const NEW_CSV = new URL("../docs/cold-start/storyverse-seed-stories.csv", import.meta.url);

function parseJsonOutput(output, commandName) {
  const starts = [output.indexOf("{"), output.indexOf("[")].filter((index) => index >= 0);
  if (!starts.length) throw new Error(`${commandName} did not return JSON.`);
  return JSON.parse(output.slice(Math.min(...starts)));
}

function projectKeys() {
  const result = spawnSync(
    "npx",
    ["supabase", "projects", "api-keys", "--project-ref", EXPECTED_PROJECT_REF, "--reveal", "--output", "json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || "Could not read Supabase API keys.");
  const payload = parseJsonOutput(result.stdout, "supabase projects api-keys");
  const keys = Array.isArray(payload) ? payload : (payload.api_keys ?? payload.keys ?? []);
  const secret = keys.find((key) => key.type === "secret") ?? keys.find((key) => key.name === "service_role");
  const secretKey = String(secret?.api_key ?? secret?.key ?? "");
  if (!secretKey) throw new Error("Could not resolve the project's secret key.");
  return secretKey;
}

function parseCsv(text) {
  const table = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) table.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim())) table.push(row);
  const headers = (table.shift() ?? []).map((header) => header.replace(/^\ufeff/, "").trim());
  return table.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
  );
}

const linkedProjectRef = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
if (linkedProjectRef !== EXPECTED_PROJECT_REF) {
  throw new Error(`Refusing audit: linked project is ${linkedProjectRef || "missing"}.`);
}

const newRows = parseCsv(await readFile(NEW_CSV, "utf8"));
const newIds = newRows.map((row) => row.external_id);
const service = createClient(`https://${EXPECTED_PROJECT_REF}.supabase.co`, projectKeys(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: seedStories, error } = await service
  .from("stories")
  .select("id,external_id,title,status,import_batch_id,created_at,body,final_type_id,final_themes")
  .eq("source_kind", "seed")
  .order("external_id");
if (error) throw error;

const { data: allStories, error: allStoriesError } = await service
  .from("stories")
  .select("id,external_id,title,status,source_kind,body,created_at")
  .order("created_at");
if (allStoriesError) throw allStoriesError;
const { data: activeAiTasks, error: activeAiTasksError } = await service
  .from("ai_tasks")
  .select("id,status,story_id,story:stories(source_kind,external_id)")
  .in("status", ["queued", "processing"]);
if (activeAiTasksError) throw activeAiTasksError;
const { data: pendingSeedReviews, error: pendingSeedReviewsError } = await service
  .from("review_cases")
  .select("id,story_id,status,priority,categories,reason,source,story:stories(external_id,title,status)")
  .in("status", ["pending", "reviewing"])
  .eq("story.source_kind", "seed");
if (pendingSeedReviewsError) throw pendingSeedReviewsError;
const reviewStoryIds = pendingSeedReviews.map((review) => review.story_id);
const { data: reviewTasks, error: reviewTasksError } = reviewStoryIds.length
  ? await service
      .from("ai_tasks")
      .select("story_id,status,attempts,last_error")
      .in("story_id", reviewStoryIds)
      .order("created_at", { ascending: false })
  : { data: [], error: null };
if (reviewTasksError) throw reviewTasksError;

function databaseLengthCheck(story) {
  const body = String(story.body ?? "").trim();
  if (story.source_kind === "seed") return body.length >= 100 && body.length <= 20000;
  const cjk = body.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu)?.length ?? 0;
  const words = body.split(/\s+/u).filter(Boolean).length;
  return cjk > 0 ? cjk >= 100 && cjk <= 1500 : words >= 100 && words <= 1500 && body.length <= 20000;
}

const lengthViolations = allStories
  .filter((story) => !databaseLengthCheck(story))
  .map((story) => {
    const body = String(story.body ?? "").trim();
    const cjkCharacters = body.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu)?.length ?? 0;
    const nonCjkText = body.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu, " ");
    const nonCjkWords = nonCjkText.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
    return {
      id: story.id,
      externalId: story.external_id,
      title: story.title,
      status: story.status,
      sourceKind: story.source_kind,
      rawCharacters: body.length,
      cjkCharacters,
      nonCjkWords,
      languageAwareUnits: cjkCharacters + nonCjkWords,
      whitespaceWords: body.split(/\s+/u).filter(Boolean).length,
      createdAt: story.created_at,
    };
  });

const newSet = new Set(newIds);
const newMatches = seedStories.filter((story) => newSet.has(story.external_id));
const unrelated = seedStories.filter((story) => !newSet.has(story.external_id));
const replacementRowById = new Map(newRows.map((row) => [row.external_id, row]));
const replacementStoryIds = newMatches.map((story) => story.id);
const { count: replacementEmbeddings, error: replacementEmbeddingError } = replacementStoryIds.length
  ? await service
      .from("story_embeddings")
      .select("story_id", { count: "exact", head: true })
      .in("story_id", replacementStoryIds)
  : { count: 0, error: null };
if (replacementEmbeddingError) throw replacementEmbeddingError;
const bodyHashMatches = newMatches.filter((story) => {
  const expected = replacementRowById.get(story.external_id)?.body ?? "";
  const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
  return hash(story.body) === hash(expected);
}).length;

console.log(
  JSON.stringify(
    {
      projectRef: EXPECTED_PROJECT_REF,
      mode: "read-only",
      csv: { replacementRows: newRows.length },
      database: {
        allStories: allStories.length,
        allSeedStories: seedStories.length,
        newCsvMatches: newMatches.length,
        newStatusCounts: Object.fromEntries(
          Object.entries(Object.groupBy(newMatches, (story) => story.status)).map(([status, items]) => [
            status,
            items.length,
          ]),
        ),
        newBodyHashMatches: bodyHashMatches,
        newEmbeddings: replacementEmbeddings ?? 0,
        newValidLabels: newMatches.filter(
          (story) => story.final_type_id && Array.isArray(story.final_themes) && story.final_themes.length === 2,
        ).length,
        unrelatedSeedStories: unrelated.length,
        newExternalIdsAlreadyPresent: newMatches.map((story) => story.external_id),
        unrelatedExternalIds: unrelated.map((story) => story.external_id),
        proposedLengthConstraintViolations: lengthViolations,
        activeAiTasks: activeAiTasks.map((task) => ({
          id: task.id,
          status: task.status,
          storyId: task.story_id,
          sourceKind: task.story?.source_kind ?? null,
          externalId: task.story?.external_id ?? null,
        })),
        pendingSeedReviews: pendingSeedReviews
          .filter((review) => review.story)
          .map((review) => ({
            reviewId: review.id,
            storyId: review.story_id,
            externalId: review.story.external_id,
            title: review.story.title,
            storyStatus: review.story.status,
            source: review.source,
            priority: review.priority,
            categories: review.categories,
            reason: review.reason,
            tasks: reviewTasks
              .filter((task) => task.story_id === review.story_id)
              .map((task) => ({ status: task.status, attempts: task.attempts, lastError: task.last_error })),
          })),
      },
    },
    null,
    2,
  ),
);
