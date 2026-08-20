import { ApiError, json, serve } from "../_shared/http.ts";
import { currentRecommendations, STAR_LOBBY_RECOMMENDATION_LIMIT } from "../_shared/recommendations.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user, client } = await requireUser(request);
  const { data: batchId, error } = await adminClient().rpc("refresh_recommendations", {
    p_user_id: user.id,
    p_limit: STAR_LOBBY_RECOMMENDATION_LIMIT,
  });
  if (error) throw error;
  return json(request, { batchId, recommendations: await currentRecommendations(client, user.id, 5) });
});
