import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let appVersion = env.VITE_APP_VERSION || "development";
  try {
    appVersion = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    // Source archives may not include .git; the explicit environment value remains the fallback.
  }

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || "/",
    define: { __APP_VERSION__: JSON.stringify(appVersion) },
    server: {
      host: "127.0.0.1",
      port: 4173,
    },
  };
});
