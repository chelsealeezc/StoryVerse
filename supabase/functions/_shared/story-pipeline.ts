import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { analyzeStoryWithArk, arkModelInfo, createEmbedding, type ModerationCategory } from "./ark.ts";
import { sha256 } from "./crypto.ts";
import { storyContentHash } from "./story-data.ts";
import type { StoryTypeId } from "./story-types.ts";

type StoryRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  mood: string;
  city: string;
  age: number;
  gender: string;
  life_stage: string;
  content_hash: string;
  status: string;
  ai_suggested_title: string | null;
  ai_type_id: string | null;
  final_type_id: string | null;
  ai_themes: string[];
  final_themes: string[];
  moderation_decision: "pass" | "human_review" | null;
  moderation_categories: ModerationCategory[];
  moderation_skipped: boolean;
};

const emotionLabels: Record<string, { value: string; zh: string; en: string }> = {
  愤怒: { value: "anger", zh: "愤怒", en: "Angry" },
  担心: { value: "fear", zh: "担心", en: "Worried" },
  失落: { value: "sadness", zh: "失落", en: "Let down" },
  愧疚: { value: "shame", zh: "愧疚", en: "Guilty" },
  平和自足: { value: "contentment", zh: "平和自足", en: "At peace" },
  开心幸福: { value: "happiness", zh: "开心幸福", en: "Happy" },
  爱: { value: "love", zh: "爱", en: "Love" },
  自信骄傲: { value: "pride", zh: "自信骄傲", en: "Proud" },
};

async function getStory(admin: SupabaseClient, storyId: string) {
  const { data, error } = await admin.from("stories").select("*").eq("id", storyId).single();
  if (error) throw error;
  return data as StoryRow;
}

async function createReviewCase(
  admin: SupabaseClient,
  story: StoryRow,
  categories: ModerationCategory[],
  reason: string,
) {
  const { data: existing } = await admin
    .from("review_cases")
    .select("id")
    .eq("story_id", story.id)
    .eq("source", "machine")
    .in("status", ["pending", "reviewing"])
    .maybeSingle();
  let reviewCaseId = existing?.id as string | undefined;
  if (reviewCaseId) {
    await admin
      .from("review_cases")
      .update({
        categories,
        reason,
        priority: categories.includes("minor") ? 100 : categories.includes("crisis") ? 90 : 10,
      })
      .eq("id", reviewCaseId);
  } else {
    const { data, error } = await admin
      .from("review_cases")
      .insert({
        story_id: story.id,
        author_id: story.user_id,
        source: "machine",
        categories,
        reason,
        priority: categories.includes("minor") ? 100 : categories.includes("crisis") ? 90 : 10,
      })
      .select("id")
      .single();
    if (error) throw error;
    reviewCaseId = data.id as string;
  }

  const { data: notification } = await admin
    .from("notifications")
    .select("id")
    .eq("review_case_id", reviewCaseId)
    .maybeSingle();
  if (!notification) {
    await admin.from("notifications").insert({
      user_id: story.user_id,
      story_id: story.id,
      review_case_id: reviewCaseId,
      status: "pending",
      kind: "flagged",
      story_title: story.title || story.ai_suggested_title || "未命名故事",
      reason: categories.includes("crisis")
        ? "我们注意到这段经历可能很艰难。可以先缓一缓，你的安全和感受更重要；故事已交给人工温和确认。"
        : "故事已经保存，并交给人工温和确认；确认前不会公开。",
    });
  }
}

async function recordModeration(
  admin: SupabaseClient,
  story: StoryRow,
  input: {
    decision: "pass" | "human_review";
    categories: ModerationCategory[];
    evidence: string[];
    reason: string;
    promptVersion: string;
    raw?: unknown;
  },
) {
  await admin.from("moderation_results").insert({
    story_id: story.id,
    decision: input.decision,
    categories: input.categories,
    evidence: input.evidence,
    reason: input.reason,
    prompt_version: input.promptVersion,
    model: arkModelInfo().text,
    input_hash: story.content_hash,
    raw_response: input.raw ?? null,
  });
}

async function failToHumanReview(admin: SupabaseClient, story: StoryRow, taskId: string, error: unknown) {
  const reason = "机器暂时无法确定公开范围，已转交人工确认。";
  await recordModeration(admin, story, {
    decision: "human_review",
    categories: [],
    evidence: [],
    reason,
    promptVersion: "storyverse-moderation-labels-v1",
  });
  await admin
    .from("stories")
    .update({ status: "pending_review", moderation_decision: "human_review", moderation_categories: [] })
    .eq("id", story.id);
  await createReviewCase(admin, story, [], reason);
  await admin
    .from("ai_tasks")
    .update({
      status: "failed",
      last_error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
      next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    .eq("id", taskId);
}

export async function processStoryAnalysis(admin: SupabaseClient, storyId: string, taskId: string) {
  const story = await getStory(admin, storyId);
  const { data: task } = await admin.from("ai_tasks").select("attempts,status").eq("id", taskId).single();
  if (task?.status === "cancelled") return story;
  await admin
    .from("ai_tasks")
    .update({ status: "processing", attempts: Number(task?.attempts ?? 0) + 1, last_error: null })
    .eq("id", taskId);

  try {
    const { data: enabledTypes } = await admin.from("story_types").select("id").eq("enabled", true).order("sort_order");
    const result = await analyzeStoryWithArk({
      title: story.title,
      body: story.body,
      city: story.city,
      age: story.age,
      gender: story.gender,
      lifeStage: story.life_stage,
      allowedTypeIds: (enabledTypes ?? []).map((type) => type.id) as StoryTypeId[],
    });
    const moderation = story.moderation_skipped
      ? {
          decision: "pass" as const,
          categories: [] as ModerationCategory[],
          evidence: [] as string[],
          reason: "管理员导入时依据授权来源跳过机审。",
          promptVersion: result.moderation.promptVersion,
        }
      : result.moderation;
    await recordModeration(admin, story, moderation);

    if (moderation.decision === "human_review") {
      await admin
        .from("stories")
        .update({
          status: "pending_review",
          moderation_decision: "human_review",
          moderation_categories: moderation.categories,
          ai_suggested_title: result.labels.suggestedTitle,
          ai_type_id: result.labels.typeId,
          ai_type_confidence: result.labels.typeConfidence,
          ai_type_candidates: result.labels.typeCandidates,
          ai_themes: result.labels.themes,
          ai_model: arkModelInfo().text,
          ai_prompt_version: result.moderation.promptVersion,
          ai_analyzed_at: new Date().toISOString(),
        })
        .eq("id", story.id);
      await createReviewCase(admin, story, moderation.categories, moderation.reason);
      await admin
        .from("ai_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", taskId);
      return getStory(admin, story.id);
    }

    const effectiveTitle = story.title || result.labels.suggestedTitle;
    const embeddingContentHash = await storyContentHash(effectiveTitle, story.body);
    const [storyEmbedding, themeEmbedding] = await Promise.all([
      createEmbedding(`${effectiveTitle}\n${story.body}`),
      createEmbedding(result.labels.themes.join(" / ")),
    ]);
    const model = arkModelInfo().embedding;
    await admin.from("story_embeddings").upsert({
      story_id: story.id,
      story_embedding: storyEmbedding,
      theme_embedding: themeEmbedding,
      model,
      model_version: model,
      content_hash: embeddingContentHash,
      theme_hash: await sha256(result.labels.themes.join("\u0000")),
      generated_at: new Date().toISOString(),
    });
    await admin
      .from("stories")
      .update({
        status: "needs_confirmation",
        moderation_decision: "pass",
        moderation_categories: [],
        ai_suggested_title: result.labels.suggestedTitle,
        ai_type_id: result.labels.typeId,
        ai_type_confidence: result.labels.typeConfidence,
        ai_type_candidates: result.labels.typeCandidates,
        final_type_id: result.labels.typeId,
        ai_themes: result.labels.themes,
        ai_model: arkModelInfo().text,
        ai_prompt_version: result.moderation.promptVersion,
        ai_analyzed_at: new Date().toISOString(),
        final_themes: result.labels.themes,
      })
      .eq("id", story.id);
    await admin
      .from("ai_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    return getStory(admin, story.id);
  } catch (error) {
    await failToHumanReview(admin, story, taskId, error);
    return getStory(admin, story.id);
  }
}

export async function archiveQueueMessage(admin: SupabaseClient, messageId: number | null) {
  if (messageId === null) return;
  const { error } = await admin.rpc("archive_story_analysis", { p_msg_id: messageId });
  if (error) console.error("Could not archive story analysis message", error);
}

export async function storyAnalysisPayload(admin: SupabaseClient, story: StoryRow) {
  const typeId = story.final_type_id || story.ai_type_id || "other_or_unclassifiable";
  const { data: type } = await admin
    .from("story_types")
    .select("id,parent_type,label_zh,label_en")
    .eq("id", typeId)
    .single();
  const emotion = emotionLabels[story.mood] ?? {
    value: "contentment",
    zh: story.mood || "平和自足",
    en: story.mood || "At peace",
  };
  const themes = (
    story.final_themes?.length
      ? story.final_themes
      : story.ai_themes?.length
        ? story.ai_themes
        : ["自我理解", "人生转折"]
  ).slice(0, 2);
  return {
    id: story.id,
    suggestedTitle: story.ai_suggested_title || story.title || "我的故事",
    tags: {
      topics: themes,
      emotions: [emotion.zh],
      meanings: [type?.label_zh ?? "其他"],
      perspectives: ["人生经验"],
    },
    arc: [
      "故事已经保存",
      story.status === "pending_review" ? "等待人工温和确认" : "完成安全与标签整理",
      "等待你的最终确认",
    ],
    storyTags: {
      emotions: [{ value: emotion.value, labelZh: emotion.zh, labelEn: emotion.en }],
      eventType: {
        parentType: type?.parent_type ?? "other",
        parentLabelZh: type?.parent_type ?? "其他",
        subtype: type?.label_en ?? "Other",
        value: typeId,
        labelEn: type?.label_en ?? "Other",
        labelZh: type?.label_zh ?? "其他",
      },
      themes: themes.map((value) => ({ value, status: "approved" })),
    },
    workflowStatus: story.status,
    moderationDecision: story.moderation_decision,
  };
}
