import type { StoryAnalysis, StoryDraft } from "../types/domain";
import { dataService } from "./data-service";

export type ImageStyle = "clay-3d" | "indie-zine" | "retro-collage";

export type StoryHighlight = {
  title: string;
  moment: string;
  scene: string;
  action: string;
  emotion: string;
};

export async function createStoryImagePreview(
  _draft: StoryDraft,
  analysis: StoryAnalysis,
  imageStyle: ImageStyle,
  _editedTags?: string[],
) {
  if (!analysis.id) throw new Error("请先完成故事分析，再生成图片。");
  return dataService.createStoryImage(analysis.id, imageStyle);
}

export function openStoryImageInNewTab(imageUrl: string) {
  const link = document.createElement("a");
  link.href = imageUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
}
