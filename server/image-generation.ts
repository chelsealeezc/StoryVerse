import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BODY_BYTES = 24 * 1024;
const MAX_STORY_CHARS = 6000;

type ImageRequest = {
  mode?: string;
  imageStyle?: string;
  title?: string;
  story?: string;
  city?: string;
  mood?: string;
  time?: string;
  stage?: string;
  gender?: string;
  people?: string[];
  tags?: string[];
};

export const IMAGE_STYLES = ["crayon", "minimal-realistic", "retro-collage"] as const;
export type ImageStyle = typeof IMAGE_STYLES[number];

export const SINGLE_IMAGE_PARAMETERS = {
  enable_sequential: false,
  n: 1,
  size: "1104*1472",
  thinking_mode: true,
  watermark: false,
} as const;

export type StoryHighlight = {
  title: string;
  moment: string;
  scene: string;
  action: string;
  emotion: string;
  composition: string;
  colorPalette: string[];
  contentPrompt: string;
  spatialLayout?: string;
  mustShow?: string[];
  mustAvoid?: string[];
};

type HandlerOptions = {
  apiKey?: string;
  workspaceId?: string;
  imageBaseUrl?: string;
  qwenBaseUrl?: string;
  imageModel?: string;
  qwenModel?: string;
};

export type ImageGenerationResult = {
  imageUrl: string;
  imageStyle: ImageStyle;
  highlight: Pick<StoryHighlight, "title" | "moment" | "scene" | "action" | "emotion">;
  imagePrompt: string;
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

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  crayon: `媒介锁定：真正粗糙、笨拙的儿童蜡笔与鼠标涂鸦，不是精致商业插画。使用干涩蜡笔颗粒、断断续续且反复描过的歪斜轮廓、轻微涂出边界的色块、偶尔露出的纸张底色、简单几何形和天真比例。人物五官只用点与短线，手部简化但数量正确；画面像普通人用蜡笔和旧版画图软件认真却不熟练地画成，低保真、可爱、诚恳、略显局促。必须保持故事动作一眼可读。`,
  "minimal-realistic": `媒介锁定：极简丝网印刷海报插画，不是动漫或照片。人物比例自然可信，但用大块几何剪影概括；只使用 4–6 种实色油墨，平涂、几乎无渐变，套色边缘轻微错位，均匀可见的细颗粒与半调网点。平视视角，清晰轮廓，背景压缩成少量水平或垂直色块，大面积留白，高饱和主色配一个温暖强调色。整体克制、安静、现代，像印在略粗糙纸张上的编辑海报。`,
  "retro-collage": `媒介锁定：真实手工纸张剪贴拼贴，不是数码绘画。人物、衣服、道具、雨水和背景都由彼此独立的剪纸层构成；必须清楚看见撕纸纤维边、剪刀切边、纸张厚度、层叠错位、柔和投影、胶带或胶点和不同纸材纹理。人物是圆润简化的韩系纸偶，五官极少；加入 2–4 个与故事有关的小型纸质道具，以及少量黑色手绘点线。以暖奶油色纸为底，主体略偏下并偏离中心，保留大面积干净留白，形成轻盈、温暖、复古杂志剪贴本质感。`,
};

const STYLE_COMPOSITION_GUIDANCE: Record<ImageStyle, string> = {
  crayon: "选择能用少量人物和大形状讲清楚的中近景；背景只保留辨认地点所需的 2–4 个元素，动作轮廓必须简单清楚。",
  "minimal-realistic": "采用平视中景或稍远景，把人物放在画面下半部或三分线位置，用建筑、道路或窗框形成简洁几何关系，并保留明显留白。",
  "retro-collage": "主体略微靠下且偏离中心，另一侧保留至少三分之一奶油色纸面留白；只选择 2–4 个有叙事意义的拼贴道具，避免铺满画面。",
};

const STYLE_EXCLUSIONS: Record<ImageStyle, string> = {
  crayon: "不要日漫脸、精致线稿、矢量描边、光滑渐变、电影级光影、写实皮肤、复杂建筑细节或专业儿童绘本质感。",
  "minimal-realistic": "不要日漫、照片写实、3D 渲染、水彩晕染、铅笔线稿、复杂纹理、细碎背景、夸张景深或戏剧性电影光效。",
  "retro-collage": "不要普通数码插画、动漫线稿、水彩、油画、3D 黏土、光滑矢量形状、完整连续描边、拥挤剪贴、深色奢华海报或可读文字。",
};

function isImageStyle(value: unknown): value is ImageStyle {
  return typeof value === "string" && (IMAGE_STYLES as readonly string[]).includes(value);
}

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
    gender: clean(input.gender, 20),
    people: cleanList(input.people, 8, 30),
    tags: cleanList(input.tags, 12, 30),
  };
}

function highlightPrompt(input: ReturnType<typeof normalizedInput>, imageStyle: ImageStyle) {
  return `请从下面这段真实人生故事中，提取唯一一个最值得被画下来的高光时刻，并为单张竖版故事插画准备内容提示词。只输出 JSON，不添加解释或 Markdown。

JSON 结构必须为：
{
  "title": "高光时刻的简短标题",
  "moment": "严格来自原文的一句话高光概述",
  "scene": "具体、可见的地点、时间、环境与关键道具",
  "action": "画面主体在这一瞬间正在做的单一可见动作",
  "emotion": "通过姿态、光线和距离表达的核心情绪",
  "composition": "适合 3:4 竖版的主体位置、视角、景别和留白",
  "colorPalette": ["3 至 6 个与故事相符的颜色或色调"],
  "contentPrompt": "不超过 220 字的中文可视化内容描述，只写一个瞬间中的主体、场景、动作、光线和色彩，不写画风",
  "spatialLayout": "用人物A/人物B/关键道具描述左右、前后、朝向、手部动作及彼此距离，避免动作歧义",
  "mustShow": ["2 至 5 个证明这是原文高光时刻的必要视觉事实"],
  "mustAvoid": ["2 至 5 个容易误读故事或破坏动作逻辑的具体画面错误"]
}

选择规则：高光必须真实存在于故事中；优先选择情绪或意义发生变化且能被一个静止画面表达的瞬间；不得把多个时间点拼在一起；不得新增重大事件、人物、地点或道具；只保留完成这个动作所需的人物和道具；明确谁在做什么、道具由哪只手持有、递向谁以及人物相对位置；不使用真实姓名，不猜测真实长相；不用对白、旁白或画面文字；避免血腥和敏感细节。

本风格的构图约束：${STYLE_COMPOSITION_GUIDANCE[imageStyle]}

用户选择的图片风格：${imageStyle}
标题：${input.title}
正文：${input.story}
城市：${input.city || "未指定"}
发生时间：${input.time || "未指定"}
人生阶段：${input.stage || "未指定"}
主角性别：${input.gender || "未指定"}
人物关系：${input.people.join("、") || "未指定"}
情绪：${input.mood || "未指定"}
标签：${input.tags.join("、") || "未指定"}`;
}

export function validateHighlight(value: unknown): StoryHighlight {
  if (!value || typeof value !== "object") throw new Error("HIGHLIGHT_INVALID");
  const raw = value as Partial<StoryHighlight>;
  const spatialLayout = clean(raw.spatialLayout, 600);
  const mustShow = cleanList(raw.mustShow, 5, 100);
  const mustAvoid = cleanList(raw.mustAvoid, 5, 100);
  const highlight = {
    title: clean(raw.title, 120) || "故事的高光时刻",
    moment: clean(raw.moment, 360),
    scene: clean(raw.scene, 600),
    action: clean(raw.action, 500),
    emotion: clean(raw.emotion, 240),
    composition: clean(raw.composition, 400),
    colorPalette: cleanList(raw.colorPalette, 6, 40),
    contentPrompt: clean(raw.contentPrompt, 1200),
    ...(spatialLayout ? { spatialLayout } : {}),
    ...(mustShow.length ? { mustShow } : {}),
    ...(mustAvoid.length ? { mustAvoid } : {}),
  };
  if (!highlight.moment || !highlight.scene || !highlight.action || !highlight.emotion || !highlight.composition || !highlight.contentPrompt) {
    throw new Error("HIGHLIGHT_INVALID");
  }
  return highlight;
}

async function createHighlight(
  input: ReturnType<typeof normalizedInput>,
  imageStyle: ImageStyle,
  apiKey: string,
  baseUrl: string,
  model: string,
) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是克制、忠于原文的故事视觉导演。严格输出指定 JSON，不添加解释或 Markdown。" },
        { role: "user", content: highlightPrompt(input, imageStyle) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const result = await response.json() as QwenResponse;
  if (!response.ok) throw new Error(`HIGHLIGHT_UPSTREAM:${result.error?.message || result.message || "千问高光提取失败"}`);
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("HIGHLIGHT_INVALID");
  return validateHighlight(JSON.parse(content));
}

export function buildSingleImagePrompt(highlight: StoryHighlight, imageStyle: ImageStyle) {
  const palette = highlight.colorPalette.length ? highlight.colorPalette.join("、") : "从故事场景中提取自然配色";
  const spatialLayout = highlight.spatialLayout ? `\n【空间与动作关系】${highlight.spatialLayout}` : "";
  const mustShow = highlight.mustShow?.length ? `\n【必须出现】${highlight.mustShow.join("；")}` : "";
  const storySpecificAvoid = highlight.mustAvoid?.length ? `；${highlight.mustAvoid.join("；")}` : "";

  return `生成一张完整的 3:4 竖版单幅故事图。先严格锁定下面的视觉媒介，再绘制故事内容；不要把它变成通用数码插画。

【画风与媒介——最高优先级】
${STYLE_PROMPTS[imageStyle]}

【主体与唯一动作】
${highlight.contentPrompt}
动作必须准确表现为：${highlight.action}

【场景】${highlight.scene}${spatialLayout}
【构图与镜头】${highlight.composition}
【情绪】${highlight.emotion}
【限定色板】${palette}${mustShow}

【必须排除】
${STYLE_EXCLUSIONS[imageStyle]}${storySpecificAvoid}
只生成一张图，不生成四格、分镜、拼版或边框。画面中完全不出现文字、字母、汉字、数字、标题、对白、路牌文字、标志、签名或水印；需要招牌时只画无字纯色块。不要增加故事之外的人物和道具。人物数量正确，双手和四肢数量正确，手指可按所选画风简化；关键道具必须完整、连续且不悬空，人物与道具的接触关系清楚。不要复原真实人物身份，不表现血腥或敏感细节。`;
}

async function generateSingleImage(prompt: string, apiKey: string, baseUrl: string, model: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: "user", content: [{ text: prompt }] }] },
      parameters: SINGLE_IMAGE_PARAMETERS,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json() as WanResponse;
  if (!response.ok) throw new Error(`SINGLE_IMAGE_UPSTREAM:${result.message || result.code || "万相单图生成失败"}`);
  const urls = result.output?.choices?.flatMap(choice =>
    choice.message?.content?.map(item => item.image).filter((url): url is string => Boolean(url)) || []
  ) || [];
  if (urls.length !== 1) throw new Error(`SINGLE_IMAGE_COUNT:${urls.length}`);
  return urls[0];
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
主角性别：${input.gender || "未指定"}
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
  const generate = createImageGenerationService({ apiKey, workspaceId, imageBaseUrl, qwenBaseUrl, imageModel, qwenModel });
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      respond(response, 405, { error: "只支持 POST 请求。" });
      return;
    }
    try {
      const requestInput = await readJson(request);
      respond(response, 200, await generate(requestInput));
    } catch (error) {
      const mapped = imageGenerationError(error);
      respond(response, mapped.status, { error: mapped.message });
    }
  };
}

export function createImageGenerationService({
  apiKey,
  workspaceId,
  imageBaseUrl,
  qwenBaseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1",
  imageModel = "wan2.7-image",
  qwenModel = "qwen-plus",
}: HandlerOptions) {
  return async (requestInput: ImageRequest): Promise<ImageGenerationResult | { storyboard: Storyboard; imageUrls: string[] }> => {
    if (!apiKey) throw new Error("IMAGE_CONFIG_API_KEY");
    const wanBaseUrl = imageBaseUrl || (validWorkspaceId(workspaceId) ? `https://${workspaceId}.cn-beijing.maas.aliyuncs.com` : "");
    if (!wanBaseUrl) throw new Error("IMAGE_CONFIG_WORKSPACE");
    const input = normalizedInput(requestInput);
    if (input.story.length < 30) throw new Error("STORY_TOO_SHORT");
    if (requestInput.mode === "single-highlight-v1") {
      if (!isImageStyle(requestInput.imageStyle)) throw new Error("IMAGE_STYLE_INVALID");
      const imageStyle = requestInput.imageStyle;
      const highlight = await createHighlight(input, imageStyle, apiKey, qwenBaseUrl, qwenModel);
      const imagePrompt = buildSingleImagePrompt(highlight, imageStyle);
      const temporaryUrl = await generateSingleImage(imagePrompt, apiKey, wanBaseUrl, imageModel);
      const imageUrl = await downloadAsDataUrl(temporaryUrl);
      return {
        imageUrl,
        imageStyle,
        highlight: { title: highlight.title, moment: highlight.moment, scene: highlight.scene, action: highlight.action, emotion: highlight.emotion },
        imagePrompt,
      };
    }
    const storyboard = await createStoryboard(input, apiKey, qwenBaseUrl, qwenModel);
    const temporaryUrls = await generateComic(storyboard, apiKey, wanBaseUrl, imageModel);
    return { storyboard, imageUrls: await Promise.all(temporaryUrls.map(downloadAsDataUrl)) };
  };
}

export function imageGenerationError(error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (message === "IMAGE_CONFIG_API_KEY") {
        return { status: 503, message: "尚未配置阿里云百炼 API Key。" };
      } else if (message === "IMAGE_CONFIG_WORKSPACE") {
        return { status: 503, message: "故事图片生成需要百炼 Workspace ID。请在服务端设置 DASHSCOPE_WORKSPACE_ID。" };
      } else if (message === "STORY_TOO_SHORT") {
        return { status: 400, message: "故事内容太短，请至少写 30 个字后再生成图片。" };
      } else if (message === "IMAGE_STYLE_INVALID") {
        return { status: 400, message: "请选择有效的图片风格。" };
      } else if (error instanceof SyntaxError || message === "HIGHLIGHT_INVALID") {
        return { status: 502, message: "千问没有返回有效的故事高光，请重新生成。" };
      } else if (message.startsWith("HIGHLIGHT_UPSTREAM:")) {
        return { status: 502, message: `千问高光提取失败：${message.slice(19, 319)}` };
      } else if (message.startsWith("SINGLE_IMAGE_UPSTREAM:")) {
        return { status: 502, message: `万相单图生成失败：${message.slice(22, 322)}` };
      } else if (message.startsWith("SINGLE_IMAGE_COUNT:")) {
        return { status: 502, message: `万相本次返回了 ${message.slice(19)} 张图片，预期只生成一张，请重新生成。` };
      } else if (error instanceof SyntaxError || message === "STORYBOARD_INVALID") {
        return { status: 502, message: "千问没有返回有效的四格分镜，请重新生成。" };
      } else if (message.startsWith("STORYBOARD_UPSTREAM:")) {
        return { status: 502, message: `千问分镜失败：${message.slice(20, 320)}` };
      } else if (message.startsWith("IMAGE_UPSTREAM:")) {
        return { status: 502, message: `万相四格生成失败：${message.slice(15, 315)}` };
      } else if (message.startsWith("IMAGE_COUNT:")) {
        return { status: 502, message: `万相本次只返回了 ${message.slice(12)} 张图片，没有形成完整四格，请重新生成。` };
      } else if (message === "IMAGE_DOWNLOAD") {
        return { status: 502, message: "图片已生成，但临时图片下载失败，请重新生成。" };
      } else if (message === "PAYLOAD_TOO_LARGE") {
        return { status: 413, message: "故事内容过长，无法生成图片。" };
      } else if (error instanceof Error && error.name === "TimeoutError") {
        return { status: 504, message: "故事图片生成超时，请稍后重试。" };
      }
      return { status: 502, message: "暂时无法生成故事图片，请稍后重试。" };
}
