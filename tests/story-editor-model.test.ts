import { describe, expect, it } from "vitest";
import { emptyDraft } from "../src/data/story-content";
import {
  getMissingRequiredStoryFields,
  imageStyleOptions,
  isStoryBodyLengthValid,
  stageOptions,
  STORY_BODY_MAX_LENGTH,
  STORY_BODY_MIN_LENGTH,
} from "../src/features/story-editor/story-editor-model";

describe("故事编辑字段规则", () => {
  it("只保留五个统一的人生阶段选项", () => {
    expect(stageOptions.map((option) => option.value)).toEqual(["学龄期", "青春期", "成年早期", "成年中期", "老年期"]);
    expect("time" in emptyDraft).toBe(false);
  });

  it("把年龄、性别和人生阶段作为必填字段", () => {
    const completeDraft = {
      ...emptyDraft,
      body: "字".repeat(STORY_BODY_MIN_LENGTH),
      mood: "平和自足",
      stage: "成年早期",
      city: "北京",
      age: "26",
      gender: "女",
      people: ["自己"],
    };

    expect(getMissingRequiredStoryFields(completeDraft)).toEqual([]);
    expect(getMissingRequiredStoryFields({ ...completeDraft, age: "" })).toContain("age");
    expect(getMissingRequiredStoryFields({ ...completeDraft, gender: "" })).toContain("gender");
    expect(getMissingRequiredStoryFields({ ...completeDraft, stage: "" })).toContain("stage");
  });

  it("正文必须在 100 到 1500 字之间", () => {
    expect(isStoryBodyLengthValid("字".repeat(STORY_BODY_MIN_LENGTH - 1))).toBe(false);
    expect(isStoryBodyLengthValid("字".repeat(STORY_BODY_MIN_LENGTH))).toBe(true);
    expect(isStoryBodyLengthValid("字".repeat(STORY_BODY_MAX_LENGTH))).toBe(true);
    expect(isStoryBodyLengthValid("字".repeat(STORY_BODY_MAX_LENGTH + 1))).toBe(false);
  });

  it("图片风格只保留三个指定选项", () => {
    expect(imageStyleOptions.map((option) => option.id)).toEqual(["clay-3d", "indie-zine", "retro-collage"]);
  });
});
