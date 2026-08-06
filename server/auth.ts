import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";

export const SESSION_COOKIE = "sv_session";
const SESSION_DAYS = 30;

export type AuthUser = { id: string; email: string; displayName: string; anonymousNumber: number };
export type AuthenticatedRequest = FastifyRequest & { authUser: AuthUser };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    // GitHub Pages and the Aliyun API gateway are different sites. Production
    // therefore needs an explicitly cross-site cookie; local development keeps
    // the safer Lax default and does not require HTTPS.
    sameSite: isProduction ? "none" : "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function createSession(pool: pg.Pool, userId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await pool.query(
    "insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [userId, hashToken(token), expiresAt],
  );
  return token;
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply, pool: pg.Pool | null) {
  if (!pool) return reply.code(503).send({ data: null, error: { code: "DATABASE_UNAVAILABLE", message: "数据库尚未连接。" }, requestId: request.id });
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return reply.code(401).send({ data: null, error: { code: "UNAUTHENTICATED", message: "请先登录。" }, requestId: request.id });
  const result = await pool.query<AuthUser>(
    `select u.id, u.email, u.display_name as "displayName", u.anonymous_number as "anonymousNumber"
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.status = 'active'`,
    [hashToken(token)],
  );
  if (!result.rowCount) {
    clearSessionCookie(reply);
    return reply.code(401).send({ data: null, error: { code: "SESSION_EXPIRED", message: "登录已过期，请重新登录。" }, requestId: request.id });
  }
  (request as AuthenticatedRequest).authUser = result.rows[0];
  await pool.query("update sessions set last_used_at = now(), expires_at = greatest(expires_at, now() + interval '30 days') where token_hash = $1", [hashToken(token)]);
}
