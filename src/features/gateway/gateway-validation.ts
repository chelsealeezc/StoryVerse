export type PasswordConfirmationState = "idle" | "match" | "mismatch";

export function isValidAccountIdentifier(value: string) {
  return /^[A-Za-z0-9_]{4,20}$/.test(value.trim());
}

export function getPasswordConfirmationState(
  password: string,
  passwordConfirmation: string,
): PasswordConfirmationState {
  if (!passwordConfirmation) return "idle";
  if (password !== passwordConfirmation) return "mismatch";
  return password.length >= 10 ? "match" : "idle";
}
