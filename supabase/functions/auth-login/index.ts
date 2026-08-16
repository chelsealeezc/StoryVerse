import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { normalizeUsername } from "../_shared/validation.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const input = await readJson<{ accountIdentifier: string; password: string }>(request);
  const username = normalizeUsername(input.accountIdentifier);
  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("username", username).maybeSingle();
  if (!profile || profile.status !== "active") throw new ApiError(401, "INVALID_CREDENTIALS", "账号或密码不正确。");
  const { data: credentials } = await admin
    .from("account_credentials")
    .select("internal_email")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!credentials) throw new ApiError(401, "INVALID_CREDENTIALS", "账号或密码不正确。");
  const { data, error } = await publicClient().auth.signInWithPassword({
    email: credentials.internal_email,
    password: String(input.password ?? ""),
  });
  if (error || !data.session) throw new ApiError(401, "INVALID_CREDENTIALS", "账号或密码不正确。");
  return json(request, { session: data.session, user: profile });
});
