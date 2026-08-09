import type { Analysis, Draft } from "./types";

export type ImageStyle = "crayon" | "minimal-realistic" | "retro-collage";

export type StoryHighlight = {
  title: string;
  moment: string;
  scene: string;
  action: string;
  emotion: string;
};

type StoryImageResponse = {
  imageUrl?: string;
  imageStyle?: ImageStyle;
  highlight?: StoryHighlight;
  imagePrompt?: string;
  error?: string;
};

export async function generateStoryImage(
  draft: Draft,
  analysis: Analysis,
  imageStyle: ImageStyle,
  editedTags?: string[],
) {
  const endpoint = import.meta.env.VITE_IMAGE_API_URL || (import.meta.env.PROD
    ? "https://dcc1fc237cf0411084a6990a6cf00cfd-cn-hangzhou.alicloudapi.com/api/generate-image"
    : "/api/generate-image");
  const tags = editedTags?.length ? editedTags : Object.values(analysis.tags).flat();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "single-highlight-v1",
        imageStyle,
        title: draft.title || analysis.suggestedTitle,
        story: draft.body,
        city: draft.city,
        mood: draft.mood,
        time: draft.time,
        stage: draft.stage,
        gender: draft.gender,
        people: draft.people,
        tags,
      }),
    });
  } catch {
    throw new Error("暂时无法连接生图服务。你可以重试，也可以先跳过生图继续发布故事。");
  }
  const payload = await response.json().catch(() => ({})) as { data?: StoryImageResponse; error?: string | { message?: string }; imageUrl?: string; imageStyle?: ImageStyle; highlight?: StoryHighlight; imagePrompt?: string };
  const result = payload.data ?? payload;
  if (!response.ok || !result.imageUrl || !result.highlight || !result.imagePrompt || result.imageStyle !== imageStyle) {
    const error = typeof payload.error === "string" ? payload.error : payload.error?.message;
    if (response.status === 401) throw new Error("登录状态已失效，请重新登录后再生图；也可以先跳过生图继续发布故事。");
    if (response.status === 429) throw new Error("今天的生图次数已用完。你可以先跳过生图继续发布故事。");
    if (response.status >= 500) throw new Error(`${error || "生图服务暂时不可用。"} 你可以先跳过生图继续发布故事。`);
    throw new Error(error || "故事图片生成失败。你可以重试，也可以先跳过生图继续发布故事。");
  }
  return {
    imageUrl: result.imageUrl,
    imageStyle: result.imageStyle,
    highlight: result.highlight,
    imagePrompt: result.imagePrompt,
  };
}

function safeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "storyverse-highlight";
}

export function downloadStoryImage(imageUrl: string, title: string, imageStyle: ImageStyle) {
  const link = document.createElement("a");
  link.href = imageUrl;
  link.download = `${safeFilename(title)}-${imageStyle}.png`;
  link.click();
}
