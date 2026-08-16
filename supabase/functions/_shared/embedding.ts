export const ARK_EMBEDDING_PATH = "/embeddings/multimodal";
export const STORY_EMBEDDING_DIMENSIONS = 1024;

export function createArkEmbeddingRequest(model: string, text: string) {
  return {
    model,
    input: [{ type: "text", text }],
    dimensions: STORY_EMBEDDING_DIMENSIONS,
    encoding_format: "float",
  } as const;
}

export function readArkEmbedding(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const embedding = (data as { embedding?: unknown }).embedding;
  if (
    !Array.isArray(embedding) ||
    embedding.length !== STORY_EMBEDDING_DIMENSIONS ||
    embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    return null;
  }

  return embedding as number[];
}
