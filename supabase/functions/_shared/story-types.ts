export const STORY_TYPE_IDS = [
  "interpersonal_conflict",
  "break_up",
  "parenthood",
  "relationship_building",
  "other_relationship",
  "death",
  "serious_illness",
  "accident_or_injury",
  "addiction",
  "other_life_threatening",
  "career_setback",
  "career_achievement",
  "mentorship",
  "formal_education",
  "self_directed_learning",
  "school_transgression",
  "other_learning",
  "recreation_or_travel",
  "relocation_or_immigration",
  "religious_or_spiritual",
  "other_or_unclassifiable",
] as const;

export type StoryTypeId = (typeof STORY_TYPE_IDS)[number];

export function isStoryTypeId(value: unknown): value is StoryTypeId {
  return typeof value === "string" && (STORY_TYPE_IDS as readonly string[]).includes(value);
}
