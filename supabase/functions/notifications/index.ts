import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  const { user, client } = await requireUser(request);
  if (request.method === "GET") {
    const { data, error } = await client
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return json(request, { notifications: data ?? [] });
  }
  if (request.method === "POST") {
    const input = await readJson<{ ids?: string[]; all?: boolean }>(request);
    let query = client.from("notifications").update({ read: true }).eq("user_id", user.id);
    if (!input.all) query = query.in("id", input.ids ?? []);
    const { error } = await query;
    if (error) throw error;
    return json(request, { updated: true });
  }
  throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
});
