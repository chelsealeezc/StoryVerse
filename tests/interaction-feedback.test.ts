import { afterEach, describe, expect, it, vi } from "vitest";
import { reactionFeedbackCopy } from "../src/lib/reaction-feedback";
import { openStoryImageInNewTab } from "../src/services/story-image";

afterEach(() => vi.unstubAllGlobals());

describe("故事图片打开方式", () => {
  it("始终在新标签页打开，不覆盖当前故事页面", () => {
    const anchor = { href: "", target: "", rel: "", click: vi.fn() };
    const createElement = vi.fn(() => anchor);
    vi.stubGlobal("document", { createElement });

    openStoryImageInNewTab("https://example.test/story.png");

    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("https://example.test/story.png");
    expect(anchor.target).toBe("_blank");
    expect(anchor.rel).toBe("noopener noreferrer");
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});

describe("故事反应反馈", () => {
  it("明确反馈不喜欢、取消和失败状态", () => {
    expect(reactionFeedbackCopy("zh", "dislike", "saving")).toBe("正在保存你的选择…");
    expect(reactionFeedbackCopy("zh", "dislike", "saved")).toBe("已记录不喜欢。");
    expect(reactionFeedbackCopy("zh", null, "saved")).toBe("已取消选择。");
    expect(reactionFeedbackCopy("zh", "dislike", "failed")).toBe("这次没有保存成功，请再试一次。");
  });

  it("英文反馈完整", () => {
    expect(reactionFeedbackCopy("en", "dislike", "saved")).toBe("Dislike saved.");
    expect(reactionFeedbackCopy("en", null, "saved")).toBe("Choice cleared.");
  });
});
