import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user, client } = await requireUser(request);
  const input = await readJson<{ storyId: string; value: "like" | "dislike" | null }>(request);
  if (!input.storyId) throw new ApiError(400, "STORY_REQUIRED", "缺少故事编号。");
  const { data: story } = await client
    .from("stories")
    .select("id,user_id")
    .eq("id", input.storyId)
    .eq("status", "published")
    .maybeSingle();
  if (!story) throw new ApiError(404, "STORY_NOT_FOUND", "没有找到这篇公开故事。");
  if (story.user_id === user.id) {
    throw new ApiError(403, "SELF_REACTION_NOT_ALLOWED", "不能对自己的故事进行喜欢或不喜欢操作。");
  }
  if (input.value === null) {
    const { error } = await client.from("reactions").delete().eq("user_id", user.id).eq("story_id", input.storyId);
    if (error) throw error;
  } else {
    if (input.value !== "like" && input.value !== "dislike")
      throw new ApiError(400, "INVALID_REACTION", "无效的操作。");
    const { error } = await client
      .from("reactions")
      .upsert({ user_id: user.id, story_id: input.storyId, value: input.value }, { onConflict: "user_id,story_id" });
    if (error) throw error;
  }
  return json(request, { storyId: input.storyId, value: input.value });
});
