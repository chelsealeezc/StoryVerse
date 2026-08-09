import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMAGE_STYLES,
  SINGLE_IMAGE_PARAMETERS,
  buildSingleImagePrompt,
  createImageGenerationService,
  validateHighlight,
  type ImageStyle,
  type StoryHighlight,
} from "../server/image-generation";
import { generateStoryImage } from "../src/image";
import type { Analysis, Draft } from "../src/types";

const highlight: StoryHighlight = {
  title: "雨停以后",
  moment: "她把旧车票折好，第一次抬头看向放晴的站台。",
  scene: "雨后的火车站台，远处天空刚刚放晴",
  action: "年轻女性把旧车票折好放进口袋并抬头",
  emotion: "克制的释然和重新出发的勇气",
  composition: "3:4 竖版，中景平视，人物略偏下，天空保留大片留白",
  colorPalette: ["雨灰", "天蓝", "暖黄色"],
  contentPrompt: "雨后的火车站台，一位年轻女性把旧车票折好放进口袋，抬头看向放晴的天空。",
};

describe("single highlight image prompts", () => {
  it("accepts a complete highlight and rejects an incomplete one", () => {
    expect(validateHighlight(highlight)).toEqual(highlight);
    expect(() => validateHighlight({ title: "缺少内容" })).toThrow("HIGHLIGHT_INVALID");
  });

  it("builds three distinct text-to-image prompts without disallowed reference wording", () => {
    const prompts = IMAGE_STYLES.map(style => buildSingleImagePrompt(highlight, style));
    expect(new Set(prompts).size).toBe(3);
    prompts.forEach(prompt => {
      expect(prompt).toContain("只生成一张图");
      expect(prompt).toContain("3:4 竖版");
      expect(prompt).toContain("无字纯色块");
      expect(prompt.length).toBeLessThan(5000);
      expect(prompt).not.toMatch(/attached image|武政谅|Take a small break|Soft little moment/i);
    });
    expect(prompts[0]).toContain("儿童蜡笔与鼠标涂鸦");
    expect(prompts[0]).toContain("不要日漫脸");
    expect(prompts[1]).toContain("4–6 种实色油墨");
    expect(prompts[1]).toContain("不要日漫");
    expect(prompts[2]).toContain("撕纸纤维边");
    expect(prompts[2]).toContain("不要普通数码插画");
  });

  it("adds explicit spatial choreography and story-specific exclusions when available", () => {
    const prompt = buildSingleImagePrompt({
      ...highlight,
      spatialLayout: "人物A在右侧，用右手把伞柄递向左侧的人物B，两人相隔一步。",
      mustShow: ["一把完整且连续的透明伞", "两个人物"],
      mustAvoid: ["人物B手中提前出现第二把伞"],
    }, "retro-collage");

    expect(prompt).toContain("【空间与动作关系】人物A在右侧");
    expect(prompt).toContain("【必须出现】一把完整且连续的透明伞；两个人物");
    expect(prompt).toContain("人物B手中提前出现第二把伞");
  });

  it("requests one portrait image without sequential comic generation", () => {
    expect(SINGLE_IMAGE_PARAMETERS).toMatchObject({
      enable_sequential: false,
      n: 1,
      size: "1104*1472",
      thinking_mode: true,
      watermark: false,
    });
  });

  it("returns the provider URL without downloading and Base64-encoding the image", async () => {
    const providerUrl = "https://example.com/temporary-story-image.png";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(highlight) } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ output: { choices: [{ message: { content: [{ image: providerUrl }] } }] } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const generate = createImageGenerationService({
      apiKey: "test-key",
      imageBaseUrl: "https://example.com",
      qwenBaseUrl: "https://example.com/compatible-mode/v1",
    });

    const result = await generate({
      mode: "single-highlight-v1",
      imageStyle: "minimal-realistic",
      story: "这是一段长度超过三十个字的测试故事，用来验证服务端不会再次下载已经生成的临时图片，而是直接返回安全的签名地址。",
    });

    expect("imageUrl" in result && result.imageUrl).toBe(providerUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

const draft: Draft = {
  guide: "turning",
  customGuide: "",
  title: "雨停以后",
  body: "离开那座城市之前，她在雨中的站台握着一张旧车票。雨停以后，她终于把车票折好放进口袋，第一次抬头看见放晴的天空。",
  mood: "释然",
  time: "最近一年",
  stage: "青年探索",
  age: "26",
  gender: "其他",
  city: "杭州",
  cityEn: "Hangzhou",
  cityCountry: "中国",
  cityLat: 30.2741,
  cityLon: 120.1551,
  people: ["自己"],
  startedAt: 0,
  edits: 0,
  pastedChars: 0,
  saves: 0,
  savedAt: 0,
};

const analysis: Analysis = {
  suggestedTitle: "雨停以后",
  tags: {
    topic: ["成长"],
    emotion: ["释然"],
    meaning: ["重新开始"],
    perspective: ["自我理解"],
  },
  arc: [],
};

describe("generateStoryImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the selected style and accepts exactly one image", async () => {
    const imageStyle: ImageStyle = "retro-collage";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        imageUrl: "data:image/png;base64,story-image",
        imageStyle,
        highlight: {
          title: highlight.title,
          moment: highlight.moment,
          scene: highlight.scene,
          action: highlight.action,
          emotion: highlight.emotion,
        },
        imagePrompt: buildSingleImagePrompt(highlight, imageStyle),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStoryImage(draft, analysis, imageStyle);
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body as string);

    expect(body.mode).toBe("single-highlight-v1");
    expect(body.imageStyle).toBe(imageStyle);
    expect(result.imageStyle).toBe(imageStyle);
    expect(result.imageUrl).toMatch(/^data:image\/png/);
  });

  it("explains that publishing can continue when the image service is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: "生图服务暂时不可用。" } }),
    }));

    await expect(generateStoryImage(draft, analysis, "crayon")).rejects.toThrow("先跳过生图继续发布故事");
  });

  it("turns a network failure into an actionable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(generateStoryImage(draft, analysis, "crayon")).rejects.toThrow("暂时无法连接生图服务");
  });
});
