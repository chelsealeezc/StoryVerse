import { createServer } from "node:http";
import { createImageGenerationHandler } from "./image-generation.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const acmeAccountThumbprint = process.env.ACME_ACCOUNT_THUMBPRINT?.trim();
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "https://chelsealeezc.github.io,http://127.0.0.1:4173")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
);

const imageHandler = createImageGenerationHandler({
  apiKey: process.env.DASHSCOPE_API_KEY,
  workspaceId: process.env.DASHSCOPE_WORKSPACE_ID,
  imageBaseUrl: process.env.DASHSCOPE_IMAGE_BASE_URL,
  qwenBaseUrl: process.env.DASHSCOPE_QWEN_BASE_URL,
  imageModel: process.env.DASHSCOPE_IMAGE_MODEL,
  qwenModel: process.env.DASHSCOPE_QWEN_MODEL,
});

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) {
      response.statusCode = 403;
      response.end();
      return;
    }
    response.statusCode = 204;
    response.end();
    return;
  }

  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  if (request.method === "GET" && acmeAccountThumbprint && pathname.startsWith("/.well-known/acme-challenge/")) {
    const token = pathname.slice("/.well-known/acme-challenge/".length);
    if (/^[A-Za-z0-9_-]+$/.test(token)) {
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end(`${token}.${acmeAccountThumbprint}`);
      return;
    }
  }
  if (
    pathname === "/health/live" ||
    pathname === "/health/ready" ||
    pathname === "/api/v1/health/live" ||
    pathname === "/api/v1/health/ready"
  ) {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (pathname === "/api/generate-image") {
    if (origin && !allowedOrigins.has(origin)) {
      response.statusCode = 403;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "不允许的网页来源。" }));
      return;
    }
    await imageHandler(request, response);
    return;
  }

  response.statusCode = 404;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`StoryVerse image API listening on port ${port}`);
});
