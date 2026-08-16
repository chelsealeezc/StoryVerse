import { arkModelInfo, createImageWithArk } from "../_shared/ark.ts";
import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { storyPayload } from "../_shared/story-data.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

const styles = new Set(["clay-3d", "indie-zine", "retro-collage"]);

function bytesFromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user } = await requireUser(request);
  const input = await readJson<{ storyId: string; style: string }>(request);
  if (!styles.has(input.style)) throw new ApiError(400, "INVALID_IMAGE_STYLE", "请选择有效的图片风格。");
  const admin = adminClient();
  const { data: story, error: storyError } = await admin
    .from("stories")
    .select("*")
    .eq("id", input.storyId)
    .eq("user_id", user.id)
    .single();
  if (storyError || !story) throw new ApiError(404, "STORY_NOT_FOUND", "没有找到这篇故事。");
  if (story.moderation_decision !== "pass")
    throw new ApiError(409, "IMAGE_BLOCKED", "故事确认公开范围后才能生成图片。");
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await admin
    .from("generated_images")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) throw new ApiError(429, "IMAGE_RATE_LIMIT", "每小时最多生成 5 张图片，请稍后再试。");

  const { data: staleImages } = await admin
    .from("generated_images")
    .select("id,storage_path")
    .eq("story_id", story.id)
    .eq("status", "ready")
    .or(`style.neq.${input.style},source_content_hash.neq.${story.content_hash}`);
  if (staleImages?.length) {
    const stalePaths = staleImages
      .map((image) => image.storage_path)
      .filter((value): value is string => Boolean(value));
    if (stalePaths.length) await admin.storage.from("story-images").remove(stalePaths);
    await admin
      .from("generated_images")
      .delete()
      .in(
        "id",
        staleImages.map((image) => image.id),
      );
  }

  const sentence =
    String(story.body)
      .split(/[。！？.!?\n]/)
      .map((value) => value.trim())
      .find((value) => value.length >= 8) ?? String(story.body).slice(0, 100);
  const highlight = {
    title: story.title || story.ai_suggested_title || "我的故事",
    moment: sentence,
    scene: [story.city, story.life_stage].filter(Boolean).join(" · "),
    action: sentence,
    emotion: story.mood,
  };
  const prompt = `${highlight.scene}；${highlight.action}；情绪：${highlight.emotion}；主题：${(story.final_themes ?? []).join("、")}`;
  const model = arkModelInfo().image;
  const { data: record, error: recordError } = await admin
    .from("generated_images")
    .insert({
      story_id: story.id,
      user_id: user.id,
      style: input.style,
      status: "generating",
      prompt,
      highlight,
      model,
      model_version: model,
      source_content_hash: story.content_hash,
    })
    .select("id")
    .single();
  if (recordError) throw recordError;

  try {
    const generated = await createImageWithArk({ prompt, style: input.style });
    let bytes: Uint8Array;
    let contentType = "image/png";
    if (generated.kind === "url") {
      const response = await fetch(generated.value);
      if (!response.ok) throw new Error(`Could not download generated image (${response.status})`);
      bytes = new Uint8Array(await response.arrayBuffer());
      contentType = response.headers.get("content-type")?.split(";")[0] || contentType;
    } else {
      bytes = bytesFromBase64(generated.value);
    }
    const extension = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
    const storagePath = `${user.id}/${story.id}/${Date.now()}-${input.style}.${extension}`;
    const { error: uploadError } = await admin.storage.from("story-images").upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = admin.storage.from("story-images").getPublicUrl(storagePath);
    await admin
      .from("generated_images")
      .update({
        status: "ready",
        storage_path: storagePath,
        public_url: publicUrl.publicUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", record.id);
    await admin.from("stories").update({ visual_status: "ready" }).eq("id", story.id);

    const { data: older } = await admin
      .from("generated_images")
      .select("id,storage_path")
      .eq("story_id", story.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .range(3, 100);
    if (older?.length) {
      const paths = older.map((item) => item.storage_path).filter((value): value is string => Boolean(value));
      if (paths.length) await admin.storage.from("story-images").remove(paths);
      await admin
        .from("generated_images")
        .delete()
        .in(
          "id",
          older.map((item) => item.id),
        );
    }
    return json(request, {
      imageUrl: publicUrl.publicUrl,
      imageStyle: input.style,
      highlight,
      imagePrompt: prompt,
      story: storyPayload({ ...story, visual_status: "ready", image_url: publicUrl.publicUrl }),
    });
  } catch (error) {
    await admin
      .from("generated_images")
      .update({ status: "failed", error: error instanceof Error ? error.message.slice(0, 1000) : String(error) })
      .eq("id", record.id);
    await admin.from("stories").update({ visual_status: "failed" }).eq("id", story.id);
    throw error;
  }
});
