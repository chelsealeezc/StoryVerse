import type { AppState } from "./domain";

export type ThemeMode = "day" | "night";
export type GatewaySection = "intro" | "preview" | "auth";
export type AuthMode = "signup" | "login";
export type GatewayAuthInput = {
  mode: AuthMode;
  displayName: string;
  accountIdentifier: string;
  password: string;
  passwordConfirmation: string;
  securityQuestion: string;
  securityAnswer: string;
};

export type AppUpdate = (patch: Partial<AppState> | ((previous: AppState) => Partial<AppState>)) => void;
