import { describe, expect, it } from "vitest";
import {
  ARK_EMBEDDING_PATH,
  createArkEmbeddingRequest,
  readArkEmbedding,
  STORY_EMBEDDING_DIMENSIONS,
} from "../supabase/functions/_shared/embedding.ts";

describe("火山方舟 Embedding", () => {
  it("使用多模态接口及其文本输入格式", () => {
    expect(ARK_EMBEDDING_PATH).toBe("/embeddings/multimodal");
    expect(createArkEmbeddingRequest("doubao-embedding-vision-251215", "我的故事")).toEqual({
      model: "doubao-embedding-vision-251215",
      input: [{ type: "text", text: "我的故事" }],
      dimensions: 1024,
      encoding_format: "float",
    });
  });

  it("读取多模态接口返回的 1024 维向量", () => {
    const embedding = Array.from({ length: STORY_EMBEDDING_DIMENSIONS }, (_, index) => index / 1000);
    expect(readArkEmbedding({ data: { object: "embedding", embedding } })).toEqual(embedding);
  });

  it("拒绝旧接口结构、错误维度和非有限数值", () => {
    const valid = Array.from({ length: STORY_EMBEDDING_DIMENSIONS }, () => 0.1);
    expect(readArkEmbedding({ data: [{ embedding: valid }] })).toBeNull();
    expect(readArkEmbedding({ data: { embedding: valid.slice(1) } })).toBeNull();
    expect(readArkEmbedding({ data: { embedding: [...valid.slice(0, -1), Number.NaN] } })).toBeNull();
  });
});
