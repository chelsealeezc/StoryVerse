import type { AppState, ScreenId, StoryEditorStep, StoryStatus } from "../types/domain";
import type { AuthMode, GatewaySection } from "../types/ui";

const routeMap = {
  intro: "/",
  storyStart: "/StoryStart",
  storyWrite: "/StoryWrite",
  storyAnalyzing: "/StoryAnalyzing",
  storyPage: "/StoryPage",
  resonance: "/Resonance",
  recommendations: "/Recommendations",
  starLobby: "/StarLobby",
  admin: "/Admin",
} as const;

const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export function externalPath(path: string) {
  return appBase && appBase !== "/" ? `${appBase}${path === "/" ? "/" : path}` : path;
}

export function normalizedPath(pathname = window.location.pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.startsWith("/StoryVerse/") ? path.slice("/StoryVerse".length) || "/" : path;
}

export function routePatchFromPath(pathname = window.location.pathname): Partial<AppState> & {
  gatewaySection?: GatewaySection;
  authMode?: AuthMode;
} {
  const path = normalizedPath(pathname);
  if (path === routeMap.storyStart) return { screen: "storyEditor", storyEditorStep: 0 };
  if (path === routeMap.storyWrite) return { screen: "storyEditor", storyEditorStep: 1 };
  if (path === routeMap.storyAnalyzing) return { screen: "storyEditor", storyEditorStep: 2 };
  if (path === routeMap.storyPage) return { screen: "storyEditor", storyEditorStep: 3 };
  if (path === routeMap.resonance) return { screen: "resonance" };
  if (path === routeMap.recommendations) return { screen: "recommendations" };
  if (path === routeMap.starLobby) return { screen: "starLobby" };
  if (path === routeMap.admin) return { screen: "admin" };
  return { screen: "intro", gatewaySection: "intro" };
}

export function authenticatedEntryScreen({
  isSignup,
  hasSavedDraft,
  hasPublishedStory,
}: {
  isSignup: boolean;
  hasSavedDraft: boolean;
  hasPublishedStory: boolean;
}): ScreenId {
  return isSignup || hasSavedDraft || !hasPublishedStory ? "storyEditor" : "starLobby";
}

export function guardPostPublishScreenForFirstStory(screen: ScreenId, hasPublishedStory: boolean): ScreenId {
  const requiresPublishedStory: ScreenId[] = ["resonance", "recommendations", "starLobby"];
  return requiresPublishedStory.includes(screen) && !hasPublishedStory ? "storyEditor" : screen;
}

/** 数据库中仍需用户查看的故事状态，对应应该恢复到的编辑器步骤。 */
export function storyEditorStepForProgress(status: StoryStatus): StoryEditorStep | null {
  if (status === "analyzing") return 2;
  if (status === "pending_review" || status === "needs_confirmation") return 3;
  return null;
}

/** 已提交过故事的用户不应因为旧链接或空的浏览器状态重新掉进空白写作页。 */
export function guardBlankEditorAfterSubmission({
  screen,
  hasSubmittedStory,
  hasDraftContent,
  hasStoryProgress,
}: {
  screen: ScreenId;
  hasSubmittedStory: boolean;
  hasDraftContent: boolean;
  hasStoryProgress: boolean;
}): ScreenId {
  return screen === "storyEditor" && hasSubmittedStory && !hasDraftContent && !hasStoryProgress ? "starLobby" : screen;
}

export function shouldAutosaveDraft(screen: ScreenId, storyEditorStep: number): boolean {
  return screen === "storyEditor" && storyEditorStep <= 1;
}

export function pathFromState(state: AppState) {
  if (state.screen === "storyEditor") {
    return (
      [routeMap.storyStart, routeMap.storyWrite, routeMap.storyAnalyzing, routeMap.storyPage][state.storyEditorStep] ??
      routeMap.storyStart
    );
  }
  if (state.screen === "resonance") return routeMap.resonance;
  if (state.screen === "recommendations") return routeMap.recommendations;
  if (state.screen === "starLobby") return routeMap.starLobby;
  if (state.screen === "admin") return routeMap.admin;
  return routeMap.intro;
}
