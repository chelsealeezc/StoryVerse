export const STAR_EXPOSURE_MIN_MS = 1_000;
export const MEANINGFUL_READ_MIN_MS = 20_000;

export function starExposureKey(lobbyViewId: string, viewMode: string, storyId: string) {
  return `${lobbyViewId}:${viewMode}:${storyId}`;
}

export function hasReachedStarExposureThreshold(visibleSince: number, now: number) {
  return now - visibleSince >= STAR_EXPOSURE_MIN_MS;
}

export function isMeaningfulStoryRead(activeDurationMs: number, isOwnStory: boolean) {
  return !isOwnStory && activeDurationMs >= MEANINGFUL_READ_MIN_MS;
}

export function normalizeLobbySearchQuery(query: string) {
  return query.trim().toLocaleLowerCase();
}
