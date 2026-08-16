import { describe, expect, it } from "vitest";
import { verifySecret } from "../supabase/functions/_shared/crypto.ts";
import { readNamedSupabaseKey } from "../supabase/functions/_shared/supabase-keys.ts";

describe("Supabase 新 API Key 集合", () => {
  it("从 default 名称读取 Publishable 或 Secret Key", () => {
    expect(readNamedSupabaseKey(JSON.stringify({ default: "sb_publishable_example" }))).toBe("sb_publishable_example");
    expect(readNamedSupabaseKey(JSON.stringify({ default: "sb_secret_example" }))).toBe("sb_secret_example");
  });

  it("缺失、格式错误或名称不匹配时拒绝配置", () => {
    expect(readNamedSupabaseKey(undefined)).toBeNull();
    expect(readNamedSupabaseKey("not-json")).toBeNull();
    expect(readNamedSupabaseKey(JSON.stringify({ other: "sb_secret_example" }))).toBeNull();
  });

  it("Worker Token 使用固定长度摘要比较", async () => {
    await expect(verifySecret("worker-token", "worker-token")).resolves.toBe(true);
    await expect(verifySecret("wrong-token", "worker-token")).resolves.toBe(false);
    await expect(verifySecret("", "worker-token")).resolves.toBe(false);
  });
});
