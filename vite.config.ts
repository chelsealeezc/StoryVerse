import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createImageGenerationHandler } from "./server/image-generation";

function imageApiPlugin(env: Record<string, string>): Plugin {
  const handler = createImageGenerationHandler({
    apiKey: env.DASHSCOPE_API_KEY,
    workspaceId: env.DASHSCOPE_WORKSPACE_ID,
    imageBaseUrl: env.DASHSCOPE_IMAGE_BASE_URL,
    qwenBaseUrl: env.DASHSCOPE_QWEN_BASE_URL,
    imageModel: env.DASHSCOPE_IMAGE_MODEL,
    qwenModel: env.DASHSCOPE_QWEN_MODEL,
  });
  const mount = (middlewares: { use: (path: string, handler: ReturnType<typeof createImageGenerationHandler>) => void }) => {
    middlewares.use("/api/generate-image", handler);
  };
  return {
    name: "storyverse-image-api",
    configureServer(server) { mount(server.middlewares); },
    configurePreviewServer(server) { mount(server.middlewares); },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), imageApiPlugin(env)],
    base: env.VITE_BASE_PATH || "/",
    server: {
      host: "127.0.0.1",
      port: 4173,
      proxy: { "/api/v1": { target: "http://127.0.0.1:3000", changeOrigin: false } },
    },
  };
});
