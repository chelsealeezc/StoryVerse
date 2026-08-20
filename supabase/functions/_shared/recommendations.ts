import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { storyPayload } from "./story-data.ts";

export const STAR_LOBBY_RECOMMENDATION_LIMIT = 15;

export async function currentRecommendations(client: SupabaseClient, userId: string, limit: number) {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const { data: batch } = await client
    .from("recommendation_batches")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (batch) {
    const { data: results, error } = await client
      .from("recommendation_results")
      .select("story_id,rank,city_score,life_score,theme_score,semantic_score,final_score")
      .eq("batch_id", batch.id)
      .order("rank")
      .limit(safeLimit);
    if (error) throw error;
    if (results?.length) {
      const ids = results.map((item) => item.story_id);
      const { data: stories, error: storiesError } = await client
        .from("stories")
        .select(
          "*,story_type:story_types!stories_final_type_id_fkey(color,label_zh,label_en),generated_images(public_url,status,created_at,prompt)",
        )
        .in("id", ids)
        .eq("status", "published");
      if (storiesError) throw storiesError;
      const byId = new Map((stories ?? []).map((story) => [story.id, story]));
      return results
        .map((result) => {
          const story = byId.get(result.story_id);
          if (!story) return null;
          return {
            story: { ...storyPayload(story), ownedByCurrentUser: story.user_id === userId },
            reason: `城市 ${Math.round(result.city_score * 100)}% · 人生阶段 ${Math.round(result.life_score * 100)}% · 主题 ${Math.round(result.theme_score * 100)}%`,
            batchId: batch.id,
            scores: result,
          };
        })
        .filter(Boolean);
    }
  }

  const { data: seedStories, error: seedError } = await client
    .from("stories")
    .select(
      "*,story_type:story_types!stories_final_type_id_fkey(color,label_zh,label_en),generated_images(public_url,status,created_at,prompt)",
    )
    .eq("status", "published")
    .eq("source_kind", "seed")
    .order("published_at", { ascending: false })
    .limit(safeLimit);
  if (seedError) throw seedError;
  return (seedStories ?? []).map((story) => ({
    story: { ...storyPayload(story), ownedByCurrentUser: story.user_id === userId },
    reason: "StoryVerse 精选故事",
  }));
}
