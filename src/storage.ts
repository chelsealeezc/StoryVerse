import { emptyDraft } from "./data";
import type { AppState } from "./types";

const KEY = "storyverse.local.v2";

export const initialState: AppState = {
  onboarded: false,
  accountCreated: false,
  firstStoryComplete: false,
  screen: "icebreaker",
  wizardStep: 0,
  openedRecommendations: [],
  resonance: { city: "similar", stage: "different", theme: "similar" },
  reactions: {},
  likedAt: {},
  draft: emptyDraft,
  analysis: null,
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...initialState, ...JSON.parse(raw) } : initialState;
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
