import { emptyDraft } from "./data";
import type { AppState } from "./types";

const KEY = "storyverse.local.v3";

export const initialState: AppState = {
  language: "zh",
  onboarded: false,
  accountCreated: false,
  firstStoryComplete: false,
  screen: "intro",
  wizardStep: 0,
  openedRecommendations: [],
  resonance: { city: "similar", stage: "different", theme: "similar" },
  reactions: {},
  likedAt: {},
  draft: emptyDraft,
  draftBox: [],
  analysis: null,
  // 首次访问：localStorage 里没有记录，enabled 保持 true，引导就会自动播放
  tour: { enabled: true, seen: [] },
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ? {
      ...initialState,
      ...parsed,
      draft: { ...emptyDraft, ...parsed.draft },
      draftBox: parsed.draftBox ?? [],
      language: parsed.language ?? "zh",
      tour: { ...initialState.tour, ...(parsed.tour ?? {}) },
    } : initialState;
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(KEY);
}
