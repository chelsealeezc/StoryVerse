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
  const response = await fetch(endpoint, {
    method: "POST",
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
  const result = await response.json().catch(() => ({})) as StoryImageResponse;
  if (!response.ok || !result.imageUrl || !result.highlight || !result.imagePrompt || result.imageStyle !== imageStyle) {
    throw new Error(result.error || "故事图片生成失败，请稍后重试。");
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
