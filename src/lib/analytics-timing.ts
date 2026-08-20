export type ActiveTimer = ReturnType<typeof createActiveTimer>;

export function createActiveTimer(now: () => number = () => performance.now()) {
  let activeMs = 0;
  let activeSince: number | null = null;
  const resume = () => {
    if (activeSince === null) activeSince = now();
  };
  const pause = () => {
    if (activeSince === null) return;
    activeMs += Math.max(0, now() - activeSince);
    activeSince = null;
  };
  const read = () => activeMs + (activeSince === null ? 0 : Math.max(0, now() - activeSince));
  const reset = () => {
    activeMs = 0;
    activeSince = null;
  };
  return { resume, pause, read, reset, isRunning: () => activeSince !== null };
}

export function pageCanAccumulateTime(
  documentVisible = document.visibilityState === "visible",
  focused = document.hasFocus(),
) {
  return documentVisible && focused;
}
