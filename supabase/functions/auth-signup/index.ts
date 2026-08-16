import { hashSecurityAnswer } from "../_shared/crypto.ts";
import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { normalizeUsername, validatePassword } from "../_shared/validation.ts";

type SignupInput = {
  accountIdentifier: string;
  password: string;
  passwordConfirmation: string;
  displayName: string;
  securityQuestion: string;
  securityAnswer: string;
};

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  const input = await readJson<SignupInput>(request);
  const username = normalizeUsername(input.accountIdentifier);
  const password = validatePassword(input.password);
  if (password !== input.passwordConfirmation) throw new ApiError(400, "PASSWORD_MISMATCH", "两次输入的密码不一致。");
  const displayName = String(input.displayName ?? "").trim();
  if (displayName.length < 1 || displayName.length > 40)
    throw new ApiError(400, "INVALID_DISPLAY_NAME", "昵称需要在 1–40 字之间。");
  const securityQuestion = String(input.securityQuestion ?? "").trim();
  const securityAnswer = String(input.securityAnswer ?? "").trim();
  if (!securityQuestion || securityAnswer.length < 2 || securityAnswer.length > 80) {
    throw new ApiError(400, "INVALID_SECURITY_ANSWER", "请选择密保问题，并填写 2–80 字的答案。");
  }

  const admin = adminClient();
  const { data: duplicate } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (duplicate) throw new ApiError(409, "ACCOUNT_EXISTS", "这个账号已经被使用。");

  const internalEmail = `${username}@users.storyverse.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName },
  });
  if (createError || !created.user) {
    if (createError?.message.toLowerCase().includes("already"))
      throw new ApiError(409, "ACCOUNT_EXISTS", "这个账号已经被使用。");
    throw createError ?? new Error("Could not create auth user");
  }

  try {
    const answer = await hashSecurityAnswer(securityAnswer);
    const anonymousNumber = Math.floor(100 + Math.random() * 900);
    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      username,
      display_name: displayName,
      anonymous_number: anonymousNumber,
    });
    if (profileError) throw profileError;
    const { error: credentialError } = await admin.from("account_credentials").insert({
      user_id: created.user.id,
      internal_email: internalEmail,
      security_question: securityQuestion,
      answer_salt: answer.salt,
      answer_hash: answer.hash,
    });
    if (credentialError) throw credentialError;
  } catch (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw error;
  }

  const { data: sessionData, error: sessionError } = await publicClient().auth.signInWithPassword({
    email: internalEmail,
    password,
  });
  if (sessionError || !sessionData.session) throw sessionError ?? new Error("Could not start session");
  const { data: profile } = await admin.from("profiles").select("*").eq("id", created.user.id).single();
  return json(request, { session: sessionData.session, user: profile }, 201);
});
