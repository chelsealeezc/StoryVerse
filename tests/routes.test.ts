import { describe, expect, it } from "vitest";
import {
  authenticatedEntryScreen,
  guardBlankEditorAfterSubmission,
  guardPostPublishScreenForFirstStory,
  shouldAutosaveDraft,
  storyEditorStepForProgress,
} from "../src/app/routes";

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

  it("只在故事选择和写作阶段自动保存，确认与发布阶段不会把已删除草稿重新写回", () => {
    expect(shouldAutosaveDraft("storyEditor", 0)).toBe(true);
    expect(shouldAutosaveDraft("storyEditor", 1)).toBe(true);
    expect(shouldAutosaveDraft("storyEditor", 2)).toBe(false);
    expect(shouldAutosaveDraft("storyEditor", 3)).toBe(false);
    expect(shouldAutosaveDraft("starLobby", 1)).toBe(false);
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

  it("从数据库恢复 AI 处理中、待确认和待人工审核的故事步骤", () => {
    expect(storyEditorStepForProgress("analyzing")).toBe(2);
    expect(storyEditorStepForProgress("needs_confirmation")).toBe(3);
    expect(storyEditorStepForProgress("pending_review")).toBe(3);
    expect(storyEditorStepForProgress("published")).toBeNull();
  });

  it("已提交过故事但没有草稿或进行中故事时，不会掉进空白写作页", () => {
    expect(
      guardBlankEditorAfterSubmission({
        screen: "storyEditor",
        hasSubmittedStory: true,
        hasDraftContent: false,
        hasStoryProgress: false,
      }),
    ).toBe("starLobby");
    expect(
      guardBlankEditorAfterSubmission({
        screen: "storyEditor",
        hasSubmittedStory: true,
        hasDraftContent: true,
        hasStoryProgress: false,
      }),
    ).toBe("storyEditor");
    expect(
      guardBlankEditorAfterSubmission({
        screen: "storyEditor",
        hasSubmittedStory: true,
        hasDraftContent: false,
        hasStoryProgress: true,
      }),
    ).toBe("storyEditor");
  });
});
