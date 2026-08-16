import { describe, expect, it } from "vitest";
import { authenticatedEntryScreen, guardPostPublishScreenForFirstStory } from "../src/app/routes";

describe("新用户进入路径", () => {
  it("新注册用户必须先进入故事编辑器", () => {
    expect(authenticatedEntryScreen({ isSignup: true, hasSavedDraft: false, hasPublishedStory: false })).toBe(
      "storyEditor",
    );
  });

  it("没有发布过故事的登录用户也必须先写故事", () => {
    expect(authenticatedEntryScreen({ isSignup: false, hasSavedDraft: false, hasPublishedStory: false })).toBe(
      "storyEditor",
    );
  });

  it("有草稿时继续编辑，而不是进入 StarLobby", () => {
    expect(authenticatedEntryScreen({ isSignup: false, hasSavedDraft: true, hasPublishedStory: false })).toBe(
      "storyEditor",
    );
  });

  it("只有发布过故事且没有草稿的用户才直接进入 StarLobby", () => {
    expect(authenticatedEntryScreen({ isSignup: false, hasSavedDraft: false, hasPublishedStory: true })).toBe(
      "starLobby",
    );
  });

  it("直接访问 StarLobby 时也不能绕过第一篇故事", () => {
    expect(guardPostPublishScreenForFirstStory("starLobby", false)).toBe("storyEditor");
    expect(guardPostPublishScreenForFirstStory("starLobby", true)).toBe("starLobby");
  });

  it("共鸣页和推荐页也不能成为新用户绕过创作流程的入口", () => {
    expect(guardPostPublishScreenForFirstStory("resonance", false)).toBe("storyEditor");
    expect(guardPostPublishScreenForFirstStory("recommendations", false)).toBe("storyEditor");
    expect(guardPostPublishScreenForFirstStory("storyEditor", false)).toBe("storyEditor");
  });
});
