import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, normalizeEmail, verifyPassword } from "../server/auth";
import { buildApp } from "../server/app";

describe("account security", () => {
  it("normalizes email and hashes opaque session tokens", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(hashToken("secret-session-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken("secret-session-token")).not.toContain("secret-session-token");
  });

  it("uses Argon2id password hashes", async () => {
    const hash = await hashPassword("A secure password! 2026");
    expect(hash).toContain("$argon2id$");
    expect(await verifyPassword(hash, "A secure password! 2026")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });
});

describe("API readiness and origin protection", () => {
  it("separates liveness from database readiness", async () => {
    const app = await buildApp({ pool: null });
    expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/health/ready" })).statusCode).toBe(503);
    await app.close();
  });

  it("rejects cross-site write requests", async () => {
    const app = await buildApp({ pool: null });
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { origin: "https://evil.example" } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ORIGIN_FORBIDDEN");
    await app.close();
  });
});
