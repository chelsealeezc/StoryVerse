import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { arkModelInfo, createImageWithArk } from "./ark.ts";
import { sha256 } from "./crypto.ts";
import { buildStoryImageFallbackPrompt, buildStoryImagePrompt } from "./image-prompt.ts";

export const SEED_IMAGE_STYLES = ["clay-3d", "indie-zine", "retro-collage"] as const;
export type SeedImageStyle = (typeof SEED_IMAGE_STYLES)[number];

function bytesFromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function firstStorySentence(body: string) {
  return (
    body
      .split(/[。！？.!?\n]/)
      .map((value) => value.trim())
      .find((value) => value.length >= 8) ?? body.slice(0, 100)
  );
}

/**
 * 冷启动故事共用系统账号，不能使用普通用户“每小时 5 张”的账户限流。
 * 该函数只由管理员接口调用；generated_images 的 story_id 唯一索引仍保证每篇只有一张。
 */
export async function generateSeedStoryImage(
  admin: SupabaseClient,
  story: Record<string, unknown>,
  style: SeedImageStyle,
) {
  const storyId = String(story.id);
  const userId = String(story.user_id);
  const { data: existing, error: existingError } = await admin
    .from("generated_images")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "ready" && existing.public_url) {
    return { imageUrl: String(existing.public_url), imageStyle: String(existing.style), reused: true };
  }

  const body = String(story.body ?? "");
  const sentence = firstStorySentence(body);
  const highlight = {
    title: String(story.title || story.ai_suggested_title || "StoryVerse 故事"),
    moment: sentence,
    scene: [story.city, story.life_stage].filter(Boolean).join(" · "),
    action: sentence,
    emotion: String(story.mood ?? ""),
  };
  const prompt = buildStoryImagePrompt(story);
  const fallbackPrompt = buildStoryImageFallbackPrompt(story);
  const sourceContentHash = await sha256(`${story.content_hash}\u0000${prompt}`);
  const model = arkModelInfo().image;
  const { data: attempt, error: attemptError } = await admin
    .from("image_generation_attempts")
    .insert({ story_id: storyId, user_id: userId, style, status: "started" })
    .select("id")
    .single();
  if (attemptError) throw attemptError;

  let imageId = String(existing?.id ?? "");
  if (existing) {
    if (existing.storage_path) await admin.storage.from("story-images").remove([String(existing.storage_path)]);
    const { error } = await admin
      .from("generated_images")
      .update({
        user_id: userId,
        style,
        status: "generating",
        prompt,
        highlight,
        model,
        model_version: model,
        source_content_hash: sourceContentHash,
        storage_path: null,
        public_url: null,
        error: null,
        created_at: new Date().toISOString(),
        completed_at: null,
      })
      .eq("id", imageId);
    if (error) throw error;
  } else {
    const { data: image, error } = await admin
      .from("generated_images")
      .insert({
        story_id: storyId,
        user_id: userId,
        style,
        status: "generating",
        prompt,
        highlight,
        model,
        model_version: model,
        source_content_hash: sourceContentHash,
      })
      .select("id")
      .single();
    if (error) throw error;
    imageId = String(image.id);
  }

  let uploadedStoragePath = "";
  try {
    const generated = await createImageWithArk({ prompt, fallbackPrompt, style });
    const actualPrompt = generated.usedFallback ? fallbackPrompt : prompt;
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
    uploadedStoragePath = `${userId}/${storyId}/${imageId}.${extension}`;
    const { error: uploadError } = await admin.storage.from("story-images").upload(uploadedStoragePath, bytes, {
      contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const imageUrl = admin.storage.from("story-images").getPublicUrl(uploadedStoragePath).data.publicUrl;
    const completedAt = new Date().toISOString();
    const { error: imageUpdateError } = await admin
      .from("generated_images")
      .update({
        status: "ready",
        prompt: actualPrompt,
        storage_path: uploadedStoragePath,
        public_url: imageUrl,
        completed_at: completedAt,
      })
      .eq("id", imageId);
    if (imageUpdateError) throw imageUpdateError;
    const { error: storyUpdateError } = await admin
      .from("stories")
      .update({ visual_status: "ready" })
      .eq("id", storyId);
    if (storyUpdateError) throw storyUpdateError;
    const { error: attemptUpdateError } = await admin
      .from("image_generation_attempts")
      .update({ status: "succeeded", completed_at: completedAt })
      .eq("id", attempt.id);
    if (attemptUpdateError) throw attemptUpdateError;
    return { imageUrl, imageStyle: style, reused: false };
  } catch (error) {
    if (uploadedStoragePath) await admin.storage.from("story-images").remove([uploadedStoragePath]);
    const message = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
    await admin
      .from("generated_images")
      .update({ status: "failed", error: message, storage_path: null, public_url: null })
      .eq("id", imageId);
    await admin
      .from("image_generation_attempts")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", attempt.id);
    await admin.from("stories").update({ visual_status: "failed" }).eq("id", storyId);
    throw error;
  }
}
