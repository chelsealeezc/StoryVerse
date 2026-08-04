import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BODY_BYTES = 24 * 1024;
const MAX_STORY_CHARS = 6000;

type ImageRequest = {
  title?: string;
  story?: string;
  city?: string;
  mood?: string;
  time?: string;
  stage?: string;
  people?: string[];
  tags?: string[];
};

type HandlerOptions = {
  apiKey?: string;
  workspaceId?: string;
  imageBaseUrl?: string;
  qwenBaseUrl?: string;
  imageModel?: string;
  qwenModel?: string;
};

type Panel = {
  order: number;
  purpose: string;
  scene: string;
  action: string;
  shot: string;
  emotion: string;
};

type Storyboard = {
  title: string;
  visualStyle: string;
  characterBible: string;
  environment: string;
  panels: Panel[];
};

type QwenResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  message?: string;
};

type WanResponse = {
  output?: {
    choices?: Array<{ message?: { content?: Array<{ image?: string; type?: string }> } }>;
  };
  code?: string;
  message?: string;
};

function respond(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<ImageRequest> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as ImageRequest;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanList(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value.filter(item => typeof item === "string").map(item => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function validWorkspaceId(value?: string) {
  return Boolean(value && /^[a-zA-Z0-9-]+$/.test(value));
}

function normalizedInput(input: ImageRequest) {
  return {
    title: clean(input.title, 120) || "一段真实的人生故事",
    story: clean(input.story, MAX_STORY_CHARS),
    city: clean(input.city, 80),
    mood: clean(input.mood, 40),
    time: clean(input.time, 40),
    stage: clean(input.stage, 40),
    people: cleanList(input.people, 8, 30),
    tags: cleanList(input.tags, 12, 30),
  };
}

function storyboardPrompt(input: ReturnType<typeof normalizedInput>) {
  return `请把下面的真实人生故事改编成严格四格、无对白的视觉分镜，并只输出 JSON。

JSON 结构必须为：
{
  "title": "漫画标题",
  "visualStyle": "统一绘画风格、色彩和光线",
  "characterBible": "主角及重要人物的固定外观、服装和辨识特征，不使用真实姓名，不猜测真实长相",
  "environment": "四格共享的时代、地点与环境视觉设定",
  "panels": [
    {"order":1,"purpose":"建立情境","scene":"场景","action":"可见动作","shot":"景别与视角","emotion":"画面情绪"},
    {"order":2,"purpose":"发展冲突","scene":"场景","action":"可见动作","shot":"景别与视角","emotion":"画面情绪"},
    {"order":3,"purpose":"关键转折","scene":"场景","action":"可见动作","shot":"景别与视角","emotion":"画面情绪"},
    {"order":4,"purpose":"结局余韵","scene":"场景","action":"可见动作","shot":"景别与视角","emotion":"画面情绪"}
  ]
}

规则：必须恰好四格；每格只描述一个可画出的瞬间；通过动作和构图表达，不使用对白、旁白或画面文字；四格要有起承转合；人物外观和服装必须能够跨格保持一致；内容温暖、克制，避免血腥和敏感细节。

标题：${input.title}
正文：${input.story}
城市：${input.city || "未指定"}
发生时间：${input.time || "未指定"}
人生阶段：${input.stage || "未指定"}
人物关系：${input.people.join("、") || "未指定"}
情绪：${input.mood || "未指定"}
标签：${input.tags.join("、") || "未指定"}`;
}

function validateStoryboard(value: unknown): Storyboard {
  if (!value || typeof value !== "object") throw new Error("STORYBOARD_INVALID");
  const raw = value as Partial<Storyboard>;
  if (!Array.isArray(raw.panels) || raw.panels.length !== 4) throw new Error("STORYBOARD_INVALID");
  const panels = raw.panels.map((panel, index) => {
    if (!panel || typeof panel !== "object") throw new Error("STORYBOARD_INVALID");
    return {
      order: index + 1,
      purpose: clean(panel.purpose, 40),
      scene: clean(panel.scene, 300),
      action: clean(panel.action, 300),
      shot: clean(panel.shot, 100),
      emotion: clean(panel.emotion, 100),
    };
  });
  if (panels.some(panel => !panel.scene || !panel.action)) throw new Error("STORYBOARD_INVALID");
  return {
    title: clean(raw.title, 120) || "我的故事四格漫画",
    visualStyle: clean(raw.visualStyle, 500) || "现代编辑漫画与细腻绘本融合，柔和电影光影",
    characterBible: clean(raw.characterBible, 700) || "人物采用非识别性的艺术化形象，跨格保持一致",
    environment: clean(raw.environment, 500),
    panels,
  };
}

async function createStoryboard(input: ReturnType<typeof normalizedInput>, apiKey: string, baseUrl: string, model: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是专业漫画分镜师。严格按照指定结构输出有效 JSON，不添加解释或 Markdown。" },
        { role: "user", content: storyboardPrompt(input) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json() as QwenResponse;
  if (!response.ok) throw new Error(`STORYBOARD_UPSTREAM:${result.error?.message || result.message || "千问分镜生成失败"}`);
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("STORYBOARD_INVALID");
  return validateStoryboard(JSON.parse(content));
}

function comicPrompt(storyboard: Storyboard) {
  const panels = storyboard.panels.map(panel =>
    `第${panel.order}张（${panel.purpose}）：场景：${panel.scene}；动作：${panel.action}；镜头：${panel.shot}；情绪：${panel.emotion}。`
  ).join("\n");
  return `为同一个真实人生故事生成严格连续的四张独立漫画插画，必须恰好输出四张图片，并按下列顺序一一对应。不要把四格画在同一张图里。

统一风格：${storyboard.visualStyle}
人物一致性设定：${storyboard.characterBible}
环境一致性设定：${storyboard.environment}

${panels}

硬性要求：四张图中的同一人物必须保持脸型、发型、年龄阶段、服装和配色一致；整体采用现代编辑漫画与细腻绘本融合的风格，电影感构图，柔和光影；每张是完整独立画面；不要任何文字、对白、标题、编号、水印、标志或漫画格线；不猜测真实人物长相；避免血腥和敏感细节。`;
}

async function generateComic(storyboard: Storyboard, apiKey: string, baseUrl: string, model: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: "user", content: [{ text: comicPrompt(storyboard) }] }] },
      parameters: { enable_sequential: true, n: 4, size: "1K", watermark: false },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const result = await response.json() as WanResponse;
  if (!response.ok) throw new Error(`IMAGE_UPSTREAM:${result.message || result.code || "万相四格生成失败"}`);
  const urls = result.output?.choices?.flatMap(choice =>
    choice.message?.content?.map(item => item.image).filter((url): url is string => Boolean(url)) || []
  ) || [];
  if (urls.length !== 4) throw new Error(`IMAGE_COUNT:${urls.length}`);
  return urls;
}

async function downloadAsDataUrl(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("IMAGE_DOWNLOAD");
  const contentType = response.headers.get("content-type") || "image/png";
  const image = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${image}`;
}

export function createImageGenerationHandler({
  apiKey,
  workspaceId,
  imageBaseUrl,
  qwenBaseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1",
  imageModel = "wan2.7-image",
  qwenModel = "qwen-plus",
}: HandlerOptions) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      respond(response, 405, { error: "只支持 POST 请求。" });
      return;
    }
    if (!apiKey) {
      respond(response, 503, { error: "尚未配置阿里云百炼 API Key。" });
      return;
    }
    const wanBaseUrl = imageBaseUrl || (validWorkspaceId(workspaceId) ? `https://${workspaceId}.cn-beijing.maas.aliyuncs.com` : "");
    if (!wanBaseUrl) {
      respond(response, 503, { error: "四格漫画需要百炼 Workspace ID。请在 .env.local 中设置 DASHSCOPE_WORKSPACE_ID。" });
      return;
    }

    try {
      const input = normalizedInput(await readJson(request));
      if (input.story.length < 30) {
        respond(response, 400, { error: "故事内容太短，请至少写 30 个字后再生成四格漫画。" });
        return;
      }
      const storyboard = await createStoryboard(input, apiKey, qwenBaseUrl, qwenModel);
      const temporaryUrls = await generateComic(storyboard, apiKey, wanBaseUrl, imageModel);
      const imageUrls = await Promise.all(temporaryUrls.map(downloadAsDataUrl));
      respond(response, 200, { storyboard, imageUrls });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (error instanceof SyntaxError || message === "STORYBOARD_INVALID") {
        respond(response, 502, { error: "千问没有返回有效的四格分镜，请重新生成。" });
      } else if (message.startsWith("STORYBOARD_UPSTREAM:")) {
        respond(response, 502, { error: `千问分镜失败：${message.slice(20, 320)}` });
      } else if (message.startsWith("IMAGE_UPSTREAM:")) {
        respond(response, 502, { error: `万相四格生成失败：${message.slice(15, 315)}` });
      } else if (message.startsWith("IMAGE_COUNT:")) {
        respond(response, 502, { error: `万相本次只返回了 ${message.slice(12)} 张图片，没有形成完整四格，请重新生成。` });
      } else if (message === "IMAGE_DOWNLOAD") {
        respond(response, 502, { error: "四格已生成，但临时图片下载失败，请重新生成。" });
      } else if (message === "PAYLOAD_TOO_LARGE") {
        respond(response, 413, { error: "故事内容过长，无法生成四格漫画。" });
      } else if (error instanceof Error && error.name === "TimeoutError") {
        respond(response, 504, { error: "四格漫画生成超时，请稍后重试。" });
      } else {
        respond(response, 502, { error: "暂时无法生成四格漫画，请稍后重试。" });
      }
    }
  };
}
