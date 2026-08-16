import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user } = await requireUser(request);
  const input = await readJson<{ storyId: string; reason: string; note?: string }>(request);
  const reason = String(input.reason ?? "").trim();
  const note = String(input.note ?? "")
    .trim()
    .slice(0, 1000);
  if (!input.storyId || !reason) throw new ApiError(400, "REPORT_REASON_REQUIRED", "请选择举报原因。");
  const admin = adminClient();
  const { data: story } = await admin.from("stories").select("id,user_id,status").eq("id", input.storyId).maybeSingle();
  if (!story || story.status !== "published") throw new ApiError(404, "STORY_NOT_FOUND", "没有找到这篇公开故事。");
  let { data: reviewCase } = await admin
    .from("review_cases")
    .select("id")
    .eq("story_id", story.id)
    .eq("source", "report")
    .in("status", ["pending", "reviewing"])
    .maybeSingle();
  if (!reviewCase) {
    const created = await admin
      .from("review_cases")
      .insert({ story_id: story.id, author_id: story.user_id, source: "report", reason, priority: 20 })
      .select("id")
      .single();
    if (created.error) throw created.error;
    reviewCase = created.data;
  }
  const { data: report, error } = await admin
    .from("reports")
    .insert({ reporter_id: user.id, story_id: story.id, reason, note, review_case_id: reviewCase.id })
    .select("id,created_at")
    .single();
  if (error) throw error;
  return json(request, { report }, 201);
});
