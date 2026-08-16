import { assertSupabaseConfigured, supabase } from "../lib/supabase";
import type {
  InboxMessage,
  ResonancePreferences,
  SavedDraft,
  Story,
  StoryAnalysis,
  StoryDraft,
  StoryReaction,
  UserProfile,
} from "../types/domain";

export class DataServiceError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "DataServiceError";
  }
}

export type StoryRecommendation = { story: Story; reason: string; scores?: Record<string, number> };

type FunctionErrorWithContext = Error & { context?: Response };

async function functionError(error: unknown): Promise<DataServiceError> {
  const candidate = error as FunctionErrorWithContext;
  try {
    const payload = (await candidate.context?.clone().json()) as { error?: string; code?: string } | undefined;
    if (payload?.error) return new DataServiceError(payload.error, payload.code ?? "FUNCTION_ERROR");
  } catch {
    // The function may have returned a non-JSON gateway error.
  }
  return new DataServiceError(candidate?.message || "服务暂时不可用，请稍后重试。", "FUNCTION_ERROR");
}

async function invoke<T>(name: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<T> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke(name, {
    body: body as Record<string, unknown> | undefined,
    method,
  });
  if (error) throw await functionError(error);
  return data as T;
}

function profileFromRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    accountIdentifier: String(row.username ?? ""),
    displayName: String(row.display_name ?? "StoryVerse"),
    anonymousNumber: Number(row.anonymous_number ?? 404),
    role: row.role === "admin" ? "admin" : "user",
    status: row.status === "suspended" ? "suspended" : "active",
  };
}

function draftFromRow(row: Record<string, unknown>): SavedDraft {
  return {
    id: String(row.id),
    version: Number(row.version ?? 1),
    guide: String(row.guide ?? ""),
    customGuide: String(row.custom_guide ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    mood: String(row.mood ?? ""),
    stage: String(row.life_stage ?? ""),
    age: row.age == null ? "" : String(row.age),
    gender: String(row.gender ?? ""),
    city: String(row.city ?? ""),
    cityNameEn: String(row.city_name_en ?? ""),
    cityCountry: String(row.city_country ?? ""),
    cityLat: row.latitude == null ? null : Number(row.latitude),
    cityLon: row.longitude == null ? null : Number(row.longitude),
    people: Array.isArray(row.people) ? row.people.map(String) : [],
    startedAt: new Date(String(row.started_at ?? row.created_at)).getTime(),
    edits: Number(row.edits ?? 0),
    pastedChars: Number(row.pasted_chars ?? 0),
    saves: Number(row.saves ?? 0),
    savedAt: new Date(String(row.saved_at ?? row.updated_at)).getTime(),
  };
}

function storyFromRow(row: Record<string, unknown>): Story {
  const body = String(row.body ?? "");
  const themes = Array.isArray(row.final_themes) ? row.final_themes.map(String) : [];
  const images = Array.isArray(row.generated_images)
    ? (row.generated_images as Array<Record<string, unknown>>).filter((image) => image.status === "ready")
    : [];
  const type = row.story_type as Record<string, unknown> | null | undefined;
  images.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return {
    id: String(row.id),
    title: String(row.title || row.ai_suggested_title || "我的故事"),
    excerpt: String(row.excerpt || body.slice(0, 70)),
    body,
    author: String(row.author_display_name || "StoryVerse"),
    city: String(row.city ?? ""),
    stage: String(row.life_stage ?? ""),
    age: Number(row.age ?? 0),
    gender: String(row.gender ?? ""),
    theme: themes[0] || "成长",
    emotion: String(row.mood || "平和自足"),
    meaning: themes[1] || "自我理解",
    perspective: "人生经验",
    people: Array.isArray(row.people) ? row.people.map(String) : [],
    readMinutes: Math.max(1, Math.ceil(body.length / 420)),
    typeId: String(row.final_type_id || row.ai_type_id || "other_or_unclassifiable"),
    typeColor: type?.color ? String(type.color) : row.typeColor ? String(row.typeColor) : undefined,
    themes,
    status: String(row.status ?? "published") as Story["status"],
    imageUrl: images[0]?.public_url ? String(images[0].public_url) : undefined,
    visualStatus:
      row.visual_status === "ready"
        ? "ready"
        : row.visual_status === "blocked"
          ? "blocked"
          : row.visual_status === "failed"
            ? "failed"
            : "generating",
    x: 50,
    y: 50,
  };
}

function notificationFromRow(row: Record<string, unknown>): InboxMessage {
  return {
    id: String(row.id),
    status: String(row.status) as InboxMessage["status"],
    kind: String(row.kind) as InboxMessage["kind"],
    storyTitle: String(row.story_title ?? ""),
    reason: String(row.reason ?? ""),
    createdAt: new Date(String(row.created_at)).getTime(),
    read: Boolean(row.read),
  };
}

export const dataService = {
  register: async (input: {
    accountIdentifier: string;
    password: string;
    passwordConfirmation: string;
    displayName: string;
    securityQuestion: string;
    securityAnswer: string;
  }) => {
    const result = await invoke<{
      session: { access_token: string; refresh_token: string };
      user: Record<string, unknown>;
    }>("auth-signup", input);
    const { error } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    if (error) throw new DataServiceError(error.message, "SESSION_ERROR");
    return { user: profileFromRow(result.user) };
  },

  login: async (input: { accountIdentifier: string; password: string }) => {
    const result = await invoke<{
      session: { access_token: string; refresh_token: string };
      user: Record<string, unknown>;
    }>("auth-login", input);
    const { error } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    if (error) throw new DataServiceError(error.message, "SESSION_ERROR");
    return { user: profileFromRow(result.user) };
  },

  resetPassword: (input: {
    accountIdentifier: string;
    securityQuestion: string;
    securityAnswer: string;
    password: string;
    passwordConfirmation: string;
  }) => invoke<{ updated: boolean }>("auth-recover", input),

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new DataServiceError(error.message, "LOGOUT_FAILED");
    return { loggedOut: true };
  },

  getCurrentUser: async () => {
    assertSupabaseConfigured();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) throw new DataServiceError("请先登录。", "UNAUTHENTICATED");
    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.session.user.id).single();
    if (error) throw new DataServiceError(error.message, "PROFILE_UNAVAILABLE");
    const user = profileFromRow(data);
    if (user.status === "suspended") {
      await supabase.auth.signOut();
      throw new DataServiceError("这个账号目前暂时无法使用。", "ACCOUNT_SUSPENDED");
    }
    return { user };
  },

  updateProfile: async (input: {
    displayName?: string;
    accountIdentifier?: string;
    password?: string;
    feedback?: string;
  }) => {
    const { user } = await dataService.getCurrentUser();
    if (input.accountIdentifier && input.accountIdentifier.trim().toLowerCase() !== user.accountIdentifier) {
      throw new DataServiceError("登录账号创建后不能直接修改。", "USERNAME_IMMUTABLE");
    }
    if (input.displayName?.trim()) {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: input.displayName.trim() })
        .eq("id", user.id);
      if (error) throw new DataServiceError(error.message, "PROFILE_UPDATE_FAILED");
    }
    if (input.password) {
      await invoke("auth-change-password", { password: input.password, passwordConfirmation: input.password });
    }
    if (input.feedback?.trim()) await invoke("feedback", { text: input.feedback.trim() });
    return dataService.getCurrentUser();
  },

  getCurrentDraft: async (): Promise<SavedDraft | null> => {
    const { user } = await dataService.getCurrentUser();
    const { data, error } = await supabase.from("story_drafts").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw new DataServiceError(error.message, "DRAFT_UNAVAILABLE");
    return data ? draftFromRow(data) : null;
  },

  saveDraft: async (draft: StoryDraft) => {
    const result = await invoke<{ draft: SavedDraft }>("story-save-draft", { draft });
    return result.draft;
  },

  analyzeDraft: async (draft: StoryDraft, storyId?: string) => {
    const result = await invoke<{ analysis: StoryAnalysis; status: string }>("story-analyze", { draft, storyId });
    return result.analysis;
  },

  publishStory: async (draft: StoryDraft, analysis: StoryAnalysis) => {
    const typeId = analysis.storyTags?.eventType.value;
    const themes = analysis.storyTags?.themes.map((theme) => theme.value) ?? analysis.tags.topics;
    const result = await invoke<{
      story: Story;
      status: Story["status"];
      analysis?: StoryAnalysis;
      requiresConfirmation?: boolean;
    }>("story-confirm", {
      storyId: analysis.id,
      draft,
      typeId,
      themes,
      emotions: analysis.storyTags?.emotions ?? [],
    });
    return result;
  },

  listStories: async () => {
    const { data, error } = await supabase
      .from("stories")
      .select(
        "*,story_type:story_types!stories_final_type_id_fkey(color),generated_images(public_url,status,created_at)",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100);
    if (error) throw new DataServiceError(error.message, "STORIES_UNAVAILABLE");
    return (data ?? []).map(storyFromRow);
  },

  listOwnedStories: async () => {
    const { user } = await dataService.getCurrentUser();
    const { data, error } = await supabase
      .from("stories")
      .select(
        "*,story_type:story_types!stories_final_type_id_fkey(color),generated_images(public_url,status,created_at)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new DataServiceError(error.message, "STORIES_UNAVAILABLE");
    return (data ?? []).map(storyFromRow);
  },

  listStoryTypes: async () => {
    const { data, error } = await supabase
      .from("story_types")
      .select("id,label_zh,label_en,color,sort_order,enabled")
      .eq("enabled", true)
      .order("sort_order");
    if (error) throw new DataServiceError(error.message, "STORY_TYPES_UNAVAILABLE");
    return data ?? [];
  },

  getResonancePreferences: async () => {
    const { user } = await dataService.getCurrentUser();
    const { data, error } = await supabase
      .from("resonance_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new DataServiceError(error.message, "RESONANCE_UNAVAILABLE");
    return {
      city: data?.city_mode ?? "similar",
      stage: data?.stage_mode ?? "different",
      theme: data?.theme_mode ?? "similar",
    } as ResonancePreferences;
  },

  saveResonancePreferences: async (value: ResonancePreferences) => {
    const { user } = await dataService.getCurrentUser();
    const { error } = await supabase
      .from("resonance_preferences")
      .upsert(
        { user_id: user.id, city_mode: value.city, stage_mode: value.stage, theme_mode: value.theme },
        { onConflict: "user_id" },
      );
    if (error) throw new DataServiceError(error.message, "RESONANCE_SAVE_FAILED");
    return value;
  },

  listRecommendations: async (): Promise<StoryRecommendation[]> => {
    let result = await invoke<{ recommendations: StoryRecommendation[] }>("recommendations-current");
    if (!result.recommendations.length) {
      result = await invoke<{ recommendations: StoryRecommendation[] }>("recommendations-refresh");
    }
    return result.recommendations.map((item) => ({
      ...item,
      story: { ...item.story, similarityScore: Number(item.scores?.semantic_score ?? item.scores?.final_score ?? 0.5) },
    }));
  },

  refreshRecommendations: async (): Promise<StoryRecommendation[]> => {
    const result = await invoke<{ recommendations: StoryRecommendation[] }>("recommendations-refresh");
    return result.recommendations.map((item) => ({
      ...item,
      story: { ...item.story, similarityScore: Number(item.scores?.semantic_score ?? item.scores?.final_score ?? 0.5) },
    }));
  },

  listLobbyStories: async (): Promise<StoryRecommendation[]> => {
    const result = await invoke<{ recommendations: StoryRecommendation[] }>("lobby-stories");
    return result.recommendations.map((item) => ({
      ...item,
      story: { ...item.story, similarityScore: Number(item.scores?.semantic_score ?? item.scores?.final_score ?? 0.5) },
    }));
  },

  setReaction: (storyId: string, value: StoryReaction) => invoke("reactions", { storyId, value }),
  clearReaction: (storyId: string) => invoke("reactions", { storyId, value: null }),
  listReactions: async () => {
    const { user } = await dataService.getCurrentUser();
    const { data, error } = await supabase.from("reactions").select("story_id,value").eq("user_id", user.id);
    if (error) throw new DataServiceError(error.message, "REACTIONS_UNAVAILABLE");
    return Object.fromEntries((data ?? []).map((row) => [row.story_id, row.value])) as Record<string, StoryReaction>;
  },
  createReport: (storyId: string, reason: string, note: string) => invoke("reports", { storyId, reason, note }),

  listNotifications: async () => {
    const { notifications } = await invoke<{ notifications: Record<string, unknown>[] }>(
      "notifications",
      undefined,
      "GET",
    );
    return notifications.map(notificationFromRow);
  },

  markNotificationsRead: (ids?: string[]) => invoke("notifications", ids ? { ids } : { all: true }),

  createStoryImage: (storyId: string, style: string) =>
    invoke<{
      imageUrl: string;
      imageStyle: string;
      highlight: { title: string; moment: string; scene: string; action: string; emotion: string };
      imagePrompt: string;
    }>("story-generate-image", { storyId, style }),

  getAdminDashboard: () => invoke<AdminDashboard>("admin-api", { action: "dashboard" }),
  adminAction: <T = { updated: boolean }>(action: string, input: Record<string, unknown>) =>
    invoke<T>("admin-api", { action, ...input }),
};

export type AdminDashboard = {
  reviews: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  stories: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  feedback: Array<Record<string, unknown>>;
  types: Array<Record<string, unknown>>;
  configs: Array<Record<string, unknown>>;
  imports: Array<Record<string, unknown>>;
  failures: Array<Record<string, unknown>>;
};
