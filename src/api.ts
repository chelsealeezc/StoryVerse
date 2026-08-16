import type { Analysis, Draft, ResonanceMode, Story } from "./types";

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null; requestId: string };

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number, public payload?: unknown) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  const payload = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok || !payload || payload.error) throw new ApiError(payload?.error?.message || "网络请求失败。", payload?.error?.code || "NETWORK_ERROR", response.status, payload);
  return payload.data as T;
}

export type User = { id: string; email: string; displayName: string; anonymousNumber: number };
export type CloudDraft = Draft & { id: string; version: number };
export type RecommendationItem = { id: string; story: Story; reason: string; position: number; openedAt: string | null };

export const api = {
  register: (input: { email: string; password: string; displayName: string }) => request<{ user: User }>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
  currentDraft: () => request<CloudDraft | null>("/drafts/current"),
  drafts: () => request<CloudDraft[]>("/drafts"),
  saveDraft: (draft: Draft) => request<CloudDraft>("/drafts/current", { method: "PUT", body: JSON.stringify(draft) }),
  analyze: (draft: Draft) => request<Analysis & { id: string }>("/stories/analyze", { method: "POST", body: JSON.stringify({ title: draft.title, body: draft.body, draftId: draft.id }) }),
  publish: (draft: Draft, analysis: Analysis) => request<{ story: Story; recommendationBatchId: string }>("/stories/publish", { method: "POST", body: JSON.stringify({ draft, analysis, analysisId: analysis.id }) }),
  stories: () => request<Story[]>("/stories"),
  mine: () => request<Story[]>("/stories/mine"),
  getResonance: () => request<Record<"city" | "stage" | "theme", ResonanceMode>>("/resonance"),
  saveResonance: (value: Record<"city" | "stage" | "theme", ResonanceMode>) => request<typeof value>("/resonance", { method: "PUT", body: JSON.stringify(value) }),
  recommendations: () => request<{ id: string; items: RecommendationItem[] }>("/recommendations", { method: "POST" }),
  openRecommendation: (itemId: string) => request<{ id: string; openedAt: string }>(`/recommendations/${itemId}/open`, { method: "POST" }),
  react: (storyId: string, value: "like" | "dislike") => request(`/stories/${storyId}/reaction`, { method: "PUT", body: JSON.stringify({ value }) }),
  removeReaction: (storyId: string) => request(`/stories/${storyId}/reaction`, { method: "DELETE" }),
  report: (storyId: string, reason: string, note: string) => request(`/stories/${storyId}/reports`, { method: "POST", body: JSON.stringify({ reason, note }) }),
};
