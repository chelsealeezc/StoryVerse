import { ApiError, json, serve } from "../_shared/http.ts";
import { verifySecret } from "../_shared/crypto.ts";
import { archiveQueueMessage, processStoryAnalysis } from "../_shared/story-pipeline.ts";
import { adminClient } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  const expectedToken = Deno.env.get("STORYVERSE_WORKER_TOKEN") ?? "";
  const actualToken = request.headers.get("x-storyverse-worker-token") ?? "";
  if (!(await verifySecret(actualToken, expectedToken))) {
    throw new ApiError(401, "WORKER_TOKEN_REQUIRED", "Worker token required");
  }
  const admin = adminClient();
  const { data, error } = await admin.rpc("claim_story_analysis");
  if (error) throw error;
  const message = Array.isArray(data) ? data[0] : data;
  if (!message) return json(request, { processed: false });
  const storyId = String(message.message?.story_id ?? "");
  const taskId = String(message.message?.task_id ?? "");
  if (!storyId || !taskId) {
    await archiveQueueMessage(admin, Number(message.msg_id));
    throw new ApiError(400, "INVALID_QUEUE_MESSAGE", "Invalid queue message");
  }
  const [{ data: story, error: storyError }, { data: task, error: taskError }] = await Promise.all([
    admin.from("stories").select("id").eq("id", storyId).maybeSingle(),
    admin.from("ai_tasks").select("id,story_id").eq("id", taskId).maybeSingle(),
  ]);
  if (storyError || taskError) throw storyError ?? taskError;
  if (!story || !task || String(task.story_id) !== storyId) {
    await archiveQueueMessage(admin, Number(message.msg_id));
    return json(request, { processed: true, skipped: "stale_message", storyId, taskId });
  }
  await processStoryAnalysis(admin, storyId, taskId);
  await archiveQueueMessage(admin, Number(message.msg_id));
  return json(request, { processed: true, storyId, taskId });
});
