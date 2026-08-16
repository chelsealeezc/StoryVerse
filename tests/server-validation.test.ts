import { describe, expect, it } from "vitest";
import {
  ACCOUNT_PATTERN,
  LIFE_STAGES,
  normalizeUsername,
  validateDraft,
  validateFinalLabels,
  validatePassword,
} from "../supabase/functions/_shared/validation.ts";
import { normalizeDraftShape } from "../supabase/functions/_shared/story-data.ts";

const completeDraft = {
  guide: "agency",
  customGuide: "",
  title: "",
  body: "字".repeat(100),
  mood: "平和自足",
  stage: "成年早期",
  age: "26",
  gender: "女",
  city: "北京",
  people: ["自己"],
};

describe("服务端账号校验", () => {
  it("账号只接受 4–20 位字母、数字和下划线，并统一为小写", () => {
    expect(ACCOUNT_PATTERN.test("Story_User_01")).toBe(true);
    expect(normalizeUsername(" Story_User_01 ")).toBe("story_user_01");
    expect(() => normalizeUsername("中文账号")).toThrow();
  });

  it("密码必须是 10–72 位", () => {
    expect(validatePassword("1234567890")).toBe("1234567890");
    expect(() => validatePassword("123456789")).toThrow();
    expect(() => validatePassword("a".repeat(73))).toThrow();
  });
});

describe("服务端故事校验", () => {
  it("使用唯一的五个人生阶段", () => {
    expect(LIFE_STAGES).toEqual(["学龄期", "青春期", "成年早期", "成年中期", "老年期"]);
    expect(() => validateDraft({ ...completeDraft, stage: "初入职场" })).toThrow();
  });

  it("正文边界严格保持 100–1500 字", () => {
    expect(validateDraft(completeDraft).body.length).toBe(100);
    expect(validateDraft({ ...completeDraft, body: "字".repeat(1500) }).body.length).toBe(1500);
    expect(() => validateDraft({ ...completeDraft, body: "字".repeat(99) })).toThrow();
    expect(() => validateDraft({ ...completeDraft, body: "字".repeat(1501) })).toThrow();
  });

  it.each([
    ["年龄", { age: "" }],
    ["性别", { gender: "" }],
    ["人生阶段", { stage: "" }],
    ["城市", { city: "" }],
    ["情绪", { mood: "" }],
    ["故事人物", { people: [] }],
  ])("%s 缺失时拒绝提交", (_label, patch) => {
    expect(() => validateDraft({ ...completeDraft, ...patch })).toThrow();
  });

  it("标题允许为空", () => {
    expect(validateDraft(completeDraft).title).toBe("");
  });

  it("未完成草稿的空年龄保存为 null，而不是错误的 0 岁", () => {
    const incomplete = validateDraft({ ...completeDraft, body: "", age: "", cityLat: null, cityLon: null }, true);
    expect(incomplete.age).toBeNull();
    expect(normalizeDraftShape(incomplete).age).toBeNull();
    expect(normalizeDraftShape(incomplete).cityLat).toBeNull();
    expect(normalizeDraftShape(incomplete).cityLon).toBeNull();
  });
});

describe("服务端最终标签校验", () => {
  it("类型必须来自 21 类，并且主题恰好两个且不重复", () => {
    expect(validateFinalLabels("career_achievement", ["职业成长", "自我肯定"])).toEqual({
      typeId: "career_achievement",
      themes: ["职业成长", "自我肯定"],
    });
    expect(() => validateFinalLabels("career", ["职业成长", "自我肯定"])).toThrow();
    expect(() => validateFinalLabels("career_achievement", ["职业成长", "职业成长"])).toThrow();
  });

  it("中文主题限制 2–6 字，英文主题限制 1–3 个词", () => {
    expect(() => validateFinalLabels("career_achievement", ["长", "自我肯定"])).toThrow();
    expect(() => validateFinalLabels("career_achievement", ["这是超过六个字的主题", "自我肯定"])).toThrow();
    expect(() => validateFinalLabels("career_achievement", ["a theme with four words", "self growth"])).toThrow();
  });
});
