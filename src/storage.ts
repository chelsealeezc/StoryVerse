import { emptyDraft } from "./data";
import type { AppState } from "./types";

const KEY = "storyverse.preferences.v1";

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
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ? { ...initialState, language: parsed.language ?? "zh" } : initialState;
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify({ language: state.language }));
}

export function resetState() {
  localStorage.removeItem(KEY);
}
