import { isStoryTypeId, STORY_TYPE_IDS, type StoryTypeId } from "./story-types.ts";
import { ARK_EMBEDDING_PATH, createArkEmbeddingRequest, readArkEmbedding } from "./embedding.ts";

const ARK_BASE_URL = Deno.env.get("ARK_BASE_URL") ?? "https://ark.cn-beijing.volces.com/api/v3";
const MODERATION_CATEGORIES = ["privacy", "attack", "distress", "crisis", "hate", "minor", "explicit", "spam"] as const;

export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];
export type ModerationResult = {
  decision: "pass" | "human_review";
  categories: ModerationCategory[];
  evidence: string[];
  reason: string;
  promptVersion: string;
};

export type StoryLabelResult = {
  suggestedTitle: string;
  typeId: StoryTypeId;
  typeConfidence: number;
  typeCandidates: Array<{ typeId: StoryTypeId; score: number }>;
  themes: [string, string];
};

export type StoryAiResult = {
  moderation: ModerationResult;
  labels: StoryLabelResult;
};

export class ArkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArkError";
  }
}

function requiredModel(name: "ARK_TEXT_MODEL" | "ARK_EMBEDDING_MODEL" | "ARK_IMAGE_MODEL") {
  const value = Deno.env.get(name);
  if (!value) throw new ArkError(`${name} is not configured`);
  return value;
}

function apiKey() {
  const value = Deno.env.get("ARK_API_KEY");
  if (!value) throw new ArkError("ARK_API_KEY is not configured");
  return value;
}

async function arkFetch(path: string, body: unknown, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${ARK_BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new ArkError(`Ark ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return await response.json();
  } catch (error) {
    if (error instanceof ArkError) throw error;
    throw new ArkError(error instanceof Error ? error.message : "Ark request failed");
  } finally {
    clearTimeout(timer);
  }
}

function responseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Array<Record<string, unknown>>) {
      if (typeof part.text === "string") return part.text;
    }
  }
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const message = (choices[0] as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
  if (typeof message?.content === "string") return message.content;
  throw new ArkError("Ark response did not contain text");
}

function parseJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new ArkError("Ark returned invalid JSON");
  }
}

function normalizeTheme(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ");
}

function isValidTheme(value: string) {
  if (!value) return false;
  const isChinese = /[\u3400-\u9fff]/.test(value);
  return isChinese
    ? Array.from(value).length >= 2 && Array.from(value).length <= 6
    : value.split(/\s+/).length >= 1 && value.split(/\s+/).length <= 3;
}

export async function analyzeStoryWithArk(input: {
  title: string;
  body: string;
  city: string;
  age: number;
  gender: string;
  lifeStage: string;
  allowedTypeIds?: StoryTypeId[];
}) {
  const allowedTypeIds = input.allowedTypeIds?.length ? input.allowedTypeIds : [...STORY_TYPE_IDS];
  const promptVersion = "storyverse-moderation-labels-v1";
  const prompt = `你是 StoryVerse 的故事整理助手。只分析，不改写用户正文。输出严格 JSON，不要 Markdown。

第一步做最简内容安全判断，decision 只能是 pass 或 human_review：
- 明确适合公开才 pass。
- 隐私泄露、针对个人/群体的攻击、创伤或危险细节、当下自伤危机、仇恨歧视、未成年人不当内容、露骨性内容、广告垃圾，或任何不确定情况，一律 human_review。
- 回顾痛苦经历本身不是惩罚对象；判断拿不准就交给人，不要说教。
- categories 只能从 privacy, attack, distress, crisis, hate, minor, explicit, spam 选择。
- evidence 只摘录必要的短片段；没有则返回空数组。

第二步仅在内容分析层面整理标签：
- suggestedTitle：不超过 18 个汉字，不改变原意。
- typeId 必须从以下当前启用项中单选：${allowedTypeIds.join(", ")}。
- typeCandidates 返回最可能的 1–3 项及 0–1 分数，即使不确定也必须给 typeId。
- themes 必须恰好两个、互不重复。中文每个 2–6 字，英文每个 1–3 个词，不使用固定词表。

JSON 结构：
{"moderation":{"decision":"pass|human_review","categories":[],"evidence":[],"reason":"一句内部说明"},"labels":{"suggestedTitle":"","typeId":"","typeConfidence":0,"typeCandidates":[{"typeId":"","score":0}],"themes":["",""]}}

故事信息：
标题：${input.title || "（未填写）"}
城市：${input.city}
年龄：${input.age}
性别：${input.gender}
人生阶段：${input.lifeStage}
正文：
${input.body}`;

  const payload = (await arkFetch("/responses", {
    model: requiredModel("ARK_TEXT_MODEL"),
    input: prompt,
    thinking: { type: "disabled" },
  })) as Record<string, unknown>;
  const parsed = parseJson(responseText(payload));
  const rawModeration = (parsed.moderation ?? {}) as Record<string, unknown>;
  const rawLabels = (parsed.labels ?? {}) as Record<string, unknown>;
  if (rawModeration.decision !== "pass" && rawModeration.decision !== "human_review") {
    throw new ArkError("Ark returned an invalid moderation decision");
  }
  const rawCategories = Array.isArray(rawModeration.categories) ? rawModeration.categories : [];
  if (
    rawCategories.some(
      (value) => typeof value !== "string" || !(MODERATION_CATEGORIES as readonly string[]).includes(value),
    )
  ) {
    throw new ArkError("Ark returned an invalid moderation category");
  }
  const categories = [...new Set(rawCategories)] as ModerationCategory[];
  const decision = rawModeration.decision;
  if (!isStoryTypeId(rawLabels.typeId) || !allowedTypeIds.includes(rawLabels.typeId)) {
    throw new ArkError("Ark returned an invalid or disabled story type");
  }
  const typeId = rawLabels.typeId;
  const rawThemes = Array.isArray(rawLabels.themes) ? rawLabels.themes.map(normalizeTheme).filter(Boolean) : [];
  const themes = [...new Set(rawThemes)].slice(0, 2);
  if (rawThemes.length !== 2 || themes.length !== 2 || themes.some((theme) => !isValidTheme(theme))) {
    throw new ArkError("Ark returned invalid story themes");
  }
  const candidates = Array.isArray(rawLabels.typeCandidates)
    ? rawLabels.typeCandidates
        .map((candidate) => candidate as Record<string, unknown>)
        .filter(
          (candidate) => isStoryTypeId(candidate.typeId) && allowedTypeIds.includes(candidate.typeId as StoryTypeId),
        )
        .slice(0, 3)
        .map((candidate) => ({
          typeId: candidate.typeId as StoryTypeId,
          score: Math.max(0, Math.min(1, Number(candidate.score) || 0)),
        }))
    : [];

  return {
    moderation: {
      decision,
      categories,
      evidence: Array.isArray(rawModeration.evidence)
        ? rawModeration.evidence
            .map(String)
            .map((value) => value.slice(0, 120))
            .slice(0, 5)
        : [],
      reason: String(rawModeration.reason ?? "").slice(0, 500),
      promptVersion,
    },
    labels: {
      suggestedTitle:
        Array.from(String(rawLabels.suggestedTitle ?? input.title ?? "我的故事").trim())
          .slice(0, 18)
          .join("") || "我的故事",
      typeId,
      typeConfidence: Math.max(0, Math.min(1, Number(rawLabels.typeConfidence) || 0)),
      typeCandidates: candidates.length ? candidates : [{ typeId, score: 0 }],
      themes: themes as [string, string],
    },
  } satisfies StoryAiResult;
}

export async function createEmbedding(input: string) {
  const payload = await arkFetch(
    ARK_EMBEDDING_PATH,
    createArkEmbeddingRequest(requiredModel("ARK_EMBEDDING_MODEL"), input),
  );
  const embedding = readArkEmbedding(payload);
  if (!embedding) {
    throw new ArkError("Embedding model did not return a valid 1024-dimensional vector");
  }
  return embedding;
}

const stylePrompt: Record<string, string> = {
  "clay-3d": "3D 粘土定格动画质感，手工捏塑纹理，柔和光线，温暖克制",
  "indie-zine": "独立杂志小志风格，半调网点，双色印刷，大量留白，编辑设计感",
  "retro-collage": "复古拼贴风格，撕纸层次，粉彩纸张纹理，温暖的编辑感",
};

export async function createImageWithArk(input: { prompt: string; style: string }) {
  const payload = (await arkFetch(
    "/images/generations",
    {
      model: requiredModel("ARK_IMAGE_MODEL"),
      prompt: `为一篇真实人生故事创作一张克制、尊重人物、无文字的横版插画。${stylePrompt[input.style] ?? stylePrompt["clay-3d"]}。${input.prompt}`,
      size: "2048x2048",
      response_format: "url",
      watermark: false,
    },
    90_000,
  )) as { data?: Array<{ url?: string; b64_json?: string }> };
  const result = payload.data?.[0];
  if (result?.url) return { kind: "url" as const, value: result.url };
  if (result?.b64_json) return { kind: "base64" as const, value: result.b64_json };
  throw new ArkError("Image model returned no image");
}

export function arkModelInfo() {
  return {
    text: Deno.env.get("ARK_TEXT_MODEL") ?? "unconfigured",
    embedding: Deno.env.get("ARK_EMBEDDING_MODEL") ?? "unconfigured",
    image: Deno.env.get("ARK_IMAGE_MODEL") ?? "unconfigured",
  };
}
