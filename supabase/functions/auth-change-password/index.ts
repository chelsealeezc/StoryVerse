import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { validatePassword } from "../_shared/validation.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const { user } = await requireUser(request);
  const input = await readJson<{ password: string; passwordConfirmation: string }>(request);
  const password = validatePassword(input.password);
  if (password !== input.passwordConfirmation) throw new ApiError(400, "PASSWORD_MISMATCH", "两次输入的密码不一致。");
  const { error } = await adminClient().auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
  return json(request, { updated: true });
});
