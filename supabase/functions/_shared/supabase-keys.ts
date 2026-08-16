export function readNamedSupabaseKey(rawKeySet: string | undefined, keyName = "default") {
  if (!rawKeySet) return null;

  try {
    const keys = JSON.parse(rawKeySet) as unknown;
    if (!keys || typeof keys !== "object" || Array.isArray(keys)) return null;
    const value = (keys as Record<string, unknown>)[keyName];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}
