import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { draftDatabaseFields, draftFromDatabase, normalizeDraftShape } from "../_shared/story-data.ts";
import { requireUser } from "../_shared/supabase.ts";
import { validateDraft, type StoryDraftInput } from "../_shared/validation.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user, client } = await requireUser(request);
  const input = await readJson<{ draft: StoryDraftInput }>(request);
  const draft = normalizeDraftShape(validateDraft(input.draft, true) as StoryDraftInput & Record<string, unknown>);
  const { data: previous } = await client
    .from("story_drafts")
    .select("version,saves")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data, error } = await client
    .from("story_drafts")
    .upsert(
      {
        user_id: user.id,
        ...draftDatabaseFields(draft),
        version: Number(previous?.version ?? 0) + 1,
        saves: Number(previous?.saves ?? draft.saves ?? 0) + 1,
        saved_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return json(request, { draft: draftFromDatabase(data) });
});
