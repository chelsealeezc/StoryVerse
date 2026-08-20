import { ApiError, json, serve } from "../_shared/http.ts";
import { currentRecommendations, STAR_LOBBY_RECOMMENDATION_LIMIT } from "../_shared/recommendations.ts";
import { requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST")
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user, client } = await requireUser(request);
  return json(request, {
    recommendations: await currentRecommendations(client, user.id, STAR_LOBBY_RECOMMENDATION_LIMIT),
  });
});
