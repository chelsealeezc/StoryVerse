import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { ApiError } from "./http.ts";
import { readNamedSupabaseKey } from "./supabase-keys.ts";

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function requiredKey(name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS") {
  const key = readNamedSupabaseKey(Deno.env.get(name));
  if (!key) throw new Error(`${name}.default is not configured`);
  return key;
}

export function adminClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredKey("SUPABASE_SECRET_KEYS"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function publicClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredKey("SUPABASE_PUBLISHABLE_KEYS"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function userClient(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new ApiError(401, "UNAUTHENTICATED", "请先登录。");
  return createClient(requiredEnv("SUPABASE_URL"), requiredKey("SUPABASE_PUBLISHABLE_KEYS"), {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireUser(request: Request): Promise<{ user: User; client: SupabaseClient }> {
  const client = userClient(request);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED", "登录状态已失效，请重新登录。");
  const { data: profile } = await client.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if (profile?.status === "suspended") throw new ApiError(403, "ACCOUNT_SUSPENDED", "这个账号目前暂时无法使用。");
  return { user: data.user, client };
}

export async function requireAdmin(request: Request) {
  const context = await requireUser(request);
  const { data, error } = await context.client.rpc("is_admin", { check_user_id: context.user.id });
  if (error || data !== true) throw new ApiError(403, "ADMIN_REQUIRED", "这个入口仅供管理员使用。");
  return context;
}
