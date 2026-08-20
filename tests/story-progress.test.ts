import { describe, expect, it } from "vitest";
import { storyProgressFromRow } from "../src/services/data-service";

const row = {
  id: "story-recovery-1",
  user_id: "user-1",
  author_display_name: "恢复测试用户",
  title: "没有丢失的故事",
  body: "这是一篇用于验证恢复流程的故事正文。".repeat(12),
  guide: "成长",
  custom_guide: "",
  mood: "平和自足",
  life_stage: "成年早期",
  age: 29,
  gender: "女",
  city: "上海",
  city_name_en: "Shanghai",
  city_country: "China",
  latitude: 31.2304,
  longitude: 121.4737,
  people: ["自己", "朋友"],
  edits: 2,
  pasted_chars: 0,
  saves: 3,
  status: "pending_review",
  moderation_decision: "human_review",
  ai_suggested_title: "没有丢失的故事",
  ai_type_id: "career_achievement",
  final_type_id: null,
  ai_themes: ["重新开始", "朋友支持"],
  final_themes: [],
  visual_status: "blocked",
  created_at: "2026-08-20T03:00:00.000Z",
  updated_at: "2026-08-20T03:05:00.000Z",
};

const type = {
  id: "career_achievement",
  parent_type: "work",
  label_zh: "职业成就",
  label_en: "Career achievement",
  color: "#F2C94C",
};

describe("数据库故事进度恢复", () => {
  it("完整恢复待人工审核故事的正文、元数据和分析状态", () => {
    const progress = storyProgressFromRow(row, type);

    expect(progress.status).toBe("pending_review");
    expect(progress.draft.body).toBe(row.body);
    expect(progress.draft.age).toBe("29");
    expect(progress.draft.cityLat).toBe(31.2304);
    expect(progress.analysis.id).toBe(row.id);
    expect(progress.analysis.workflowStatus).toBe("pending_review");
    expect(progress.analysis.moderationDecision).toBe("human_review");
    expect(progress.analysis.storyTags?.eventType.value).toBe("career_achievement");
    expect(progress.analysis.storyTags?.themes.map((theme) => theme.value)).toEqual(row.ai_themes);
  });

  it("恢复待确认故事时优先使用用户最终主题", () => {
    const progress = storyProgressFromRow(
      {
        ...row,
        status: "needs_confirmation",
        moderation_decision: "pass",
        final_type_id: "career_achievement",
        final_themes: ["最终主题一", "最终主题二"],
      },
      type,
    );

    expect(progress.analysis.workflowStatus).toBe("needs_confirmation");
    expect(progress.analysis.storyTags?.themes.map((theme) => theme.value)).toEqual(["最终主题一", "最终主题二"]);
  });
});
