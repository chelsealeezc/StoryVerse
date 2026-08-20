import { verifySecurityAnswer } from "../_shared/crypto.ts";
import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { normalizeUsername, validatePassword, validatePasswordConfirmation } from "../_shared/validation.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const input = await readJson<{
    accountIdentifier: string;
    securityQuestion: string;
    securityAnswer: string;
    password: string;
    passwordConfirmation: string;
  }>(request);
  const username = normalizeUsername(input.accountIdentifier);
  const password = validatePassword(input.password);
  validatePasswordConfirmation(password, input.passwordConfirmation);
  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("id,status").eq("username", username).maybeSingle();
  const { data: credentials } = profile
    ? await admin
        .from("account_credentials")
        .select("security_question,answer_salt,answer_hash")
        .eq("user_id", profile.id)
        .maybeSingle()
    : { data: null };
  const valid = credentials
    ? credentials.security_question === String(input.securityQuestion ?? "") &&
      (await verifySecurityAnswer(String(input.securityAnswer ?? ""), credentials.answer_salt, credentials.answer_hash))
    : false;
  if (!profile || profile.status !== "active" || !valid) {
    throw new ApiError(400, "RECOVERY_FAILED", "账号、找回密码问题或答案不正确。");
  }
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (error) throw error;
  return json(request, { updated: true });
});
