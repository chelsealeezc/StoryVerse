import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  SEED_STORY_BODY_MAX_LENGTH,
  STORY_BODY_MAX_LENGTH,
  validateDraft,
  type StoryDraftInput,
} from "../supabase/functions/_shared/validation.ts";

const EXPECTED_HEADERS = [
  "external_id",
  "title",
  "body",
  "age",
  "gender",
  "stage",
  "city",
  "latitude",
  "longitude",
  "mood",
  "people",
  "source_note",
  "skip_moderation",
] as const;

function parseCsv(text: string) {
  const table: string[][] = [];
  let row: string[] = [];
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
  if (headers.join("\u0000") !== EXPECTED_HEADERS.join("\u0000")) {
    throw new Error(`CSV headers do not match the admin importer: ${headers.join(",")}`);
  }
  return table.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
  );
}

function toDraft(row: Record<string, string>): StoryDraftInput {
  return {
    guide: "",
    customGuide: "",
    title: row.title,
    body: row.body,
    age: row.age,
    gender: row.gender,
    stage: row.stage,
    city: row.city,
    cityLat: Number(row.latitude),
    cityLon: Number(row.longitude),
    mood: row.mood,
    people: row.people
      .split(/[|;；、]/)
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

const path = resolve(process.argv[2] ?? "outputs/storyverse-seed-20/StoryVerse_seed_integrated_20_import_ready.csv");
const rows = parseCsv(await readFile(path, "utf8"));
if (!rows.length || rows.length > 500) throw new Error(`Admin importer only accepts 1–500 rows; got ${rows.length}.`);
if (new Set(rows.map((row) => row.external_id)).size !== rows.length) {
  throw new Error("external_id values are not unique.");
}

const seedExceptions: string[] = [];
for (const row of rows) {
  const draft = toDraft(row);
  validateDraft(draft, false, { maxBodyLength: SEED_STORY_BODY_MAX_LENGTH });
  try {
    validateDraft(draft, false, { maxBodyLength: STORY_BODY_MAX_LENGTH });
  } catch {
    seedExceptions.push(row.external_id);
  }
}

console.log(
  JSON.stringify(
    {
      file: path,
      rows: rows.length,
      uniqueExternalIds: rows.length,
      seedValidationPassed: rows.length,
      ordinaryLimitPassed: rows.length - seedExceptions.length,
      seedExceptions,
    },
    null,
    2,
  ),
);
