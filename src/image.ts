import type { Analysis, Draft } from "./types";

export type ComicPanel = {
  order: number;
  purpose: string;
  scene: string;
  action: string;
  shot: string;
  emotion: string;
};

export type ComicStoryboard = {
  title: string;
  visualStyle: string;
  characterBible: string;
  environment: string;
  panels: ComicPanel[];
};

type ComicResponse = {
  imageUrls?: string[];
  storyboard?: ComicStoryboard;
  error?: string;
};

export async function generateStoryComic(draft: Draft, analysis: Analysis, editedTags?: string[]) {
  const endpoint = import.meta.env.VITE_IMAGE_API_URL || "/api/generate-image";
  const tags = editedTags?.length ? editedTags : Object.values(analysis.tags).flat();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: draft.title || analysis.suggestedTitle,
      story: draft.body,
      city: draft.city,
      mood: draft.mood,
      time: draft.time,
      stage: draft.stage,
      people: draft.people,
      tags,
    }),
  });
  const result = await response.json().catch(() => ({})) as ComicResponse;
  if (!response.ok || result.imageUrls?.length !== 4 || !result.storyboard) {
    throw new Error(result.error || "四格漫画生成失败，请稍后重试。");
  }
  return { imageUrls: result.imageUrls, storyboard: result.storyboard };
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("漫画图片载入失败。"));
    image.src = url;
  });
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number) {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
}

export async function downloadFourPanelComic(imageUrls: string[], title: string) {
  if (imageUrls.length !== 4) throw new Error("需要四张图片才能合成漫画。");
  const images = await Promise.all(imageUrls.map(loadImage));
  const canvas = document.createElement("canvas");
  const canvasSize = 2048;
  const outer = 32;
  const gap = 24;
  const panelSize = (canvasSize - outer * 2 - gap) / 2;
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法合成漫画。");
  context.fillStyle = "#f7f6f2";
  context.fillRect(0, 0, canvasSize, canvasSize);
  images.forEach((image, index) => {
    const x = outer + (index % 2) * (panelSize + gap);
    const y = outer + Math.floor(index / 2) * (panelSize + gap);
    context.save();
    context.beginPath();
    context.rect(x, y, panelSize, panelSize);
    context.clip();
    drawCover(context, image, x, y, panelSize);
    context.restore();
  });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(value => value ? resolve(value) : reject(new Error("漫画合成失败。")), "image/png")
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${title.trim() || "storyverse-four-panel"}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
