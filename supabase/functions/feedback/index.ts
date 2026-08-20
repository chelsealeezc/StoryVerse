import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user, client } = await requireUser(request);
  const input = await readJson<{ text: string }>(request);
  const text = String(input.text ?? "").trim();
  if (!text || text.length > 2000) throw new ApiError(400, "INVALID_FEEDBACK", "反馈内容需要在 1–2000 字之间。");
  const { data, error } = await client.from("feedback").insert({ user_id: user.id, text }).select("id").single();
  if (error) throw error;
  return json(request, { id: data.id }, 201);
});
