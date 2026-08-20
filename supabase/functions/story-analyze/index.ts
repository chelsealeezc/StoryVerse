import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { draftDatabaseFields, normalizeDraftShape, storyContentHash } from "../_shared/story-data.ts";
import { archiveQueueMessage, processStoryAnalysis, storyAnalysisPayload } from "../_shared/story-pipeline.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { validateDraft, type StoryDraftInput } from "../_shared/validation.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user } = await requireUser(request);
  const input = await readJson<{ draft: StoryDraftInput; storyId?: string }>(request);
  const draft = normalizeDraftShape(validateDraft(input.draft) as StoryDraftInput & Record<string, unknown>);
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (profileError) throw profileError;
  const contentHash = await storyContentHash(draft.title, draft.body);
  let existing: Record<string, unknown> | null = null;
  if (input.storyId) {
    const { data } = await admin
      .from("stories")
      .select("*")
      .eq("id", input.storyId)
      .eq("user_id", user.id)
      .maybeSingle();
    existing = data;
    if (!existing) throw new ApiError(404, "STORY_NOT_FOUND", "没有找到这篇故事。");
    if (existing) {
      const { data: openReviews } = await admin
        .from("review_cases")
        .select("id")
        .eq("story_id", existing.id)
        .in("status", ["pending", "reviewing"]);
      const reviewIds = (openReviews ?? []).map((review) => review.id);
      await admin
        .from("review_cases")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("story_id", existing.id)
        .in("status", ["pending", "reviewing"]);
      if (reviewIds.length) await admin.from("notifications").delete().in("review_case_id", reviewIds);
      await admin
        .from("ai_tasks")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("story_id", existing.id)
        .in("status", ["queued", "processing"]);
      const { data: oldImages } = await admin
        .from("generated_images")
        .select("storage_path")
        .eq("story_id", existing.id);
      const imagePaths = (oldImages ?? [])
        .map((image) => image.storage_path)
        .filter((value): value is string => Boolean(value));
      if (imagePaths.length) await admin.storage.from("story-images").remove(imagePaths);
      await admin.from("generated_images").delete().eq("story_id", existing.id);
      await admin.from("story_embeddings").delete().eq("story_id", existing.id);
    }
  }
  const storyFields = {
    ...draftDatabaseFields(draft),
    user_id: user.id,
    author_display_name: profile.display_name || `星旅人 ${profile.anonymous_number}`,
    excerpt: draft.body.slice(0, 70),
    status: "analyzing",
    content_hash: contentHash,
    moderation_decision: null,
    moderation_categories: [],
    ai_suggested_title: null,
    ai_type_id: null,
    ai_type_confidence: null,
    ai_type_candidates: [],
    final_type_id: null,
    ai_themes: [],
    ai_model: null,
    ai_prompt_version: null,
    ai_analyzed_at: null,
    final_themes: [],
    visual_status: "queued",
    published_at: null,
    analysis_version: Number(existing?.analysis_version ?? 0) + 1,
  };
  const { data: story, error: storyError } = existing
    ? await admin.from("stories").update(storyFields).eq("id", existing.id).select("*").single()
    : await admin.from("stories").insert(storyFields).select("*").single();
  if (storyError) throw storyError;

  const { data: task, error: taskError } = await admin
    .from("ai_tasks")
    .insert({ story_id: story.id, user_id: user.id, task_type: "story_analysis", status: "queued" })
    .select("id")
    .single();
  if (taskError) throw taskError;
  const { data: messageId, error: queueError } = await admin.rpc("queue_story_analysis", {
    p_story_id: story.id,
    p_task_id: task.id,
  });
  if (queueError) throw queueError;
  const processed = await processStoryAnalysis(admin, story.id, task.id);
  await archiveQueueMessage(admin, typeof messageId === "number" ? messageId : Number(messageId));
  return json(request, { analysis: await storyAnalysisPayload(admin, processed), status: processed.status });
});
