import type { Language, StoryReaction } from "../types/domain";

export type ReactionFeedbackPhase = "saving" | "saved" | "failed";

export function reactionFeedbackCopy(language: Language, reaction: StoryReaction | null, phase: ReactionFeedbackPhase) {
  if (phase === "saving") return language === "zh" ? "正在保存你的选择…" : "Saving your choice…";
  if (phase === "failed")
    return language === "zh" ? "这次没有保存成功，请再试一次。" : "Your choice was not saved. Please try again.";
  if (reaction === "like") return language === "zh" ? "已记录喜欢。" : "Like saved.";
  if (reaction === "dislike") return language === "zh" ? "已记录不喜欢。" : "Dislike saved.";
  return language === "zh" ? "已取消选择。" : "Choice cleared.";
}
