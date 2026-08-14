/**
 * 语音转文字 —— 对接豆包（火山引擎）大模型语音识别。
 *
 * 和 image-generation.ts 一样，API Key 只存在于服务端环境变量里，
 * 绝对不能进前端产物：前端只会 POST 一段音频到 /api/transcribe。
 *
 * 需求文档（0809 后端接入上线需求 · 2.4）给的接入信息：
 *   默认资源：volc.bigasr.auc_turbo
 *   默认接口：https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash
 *   Header 使用 X-Api-Key
 *
 * 火山的这套 v3 接口实际上要三个头（App Key / Access Key / Resource Id）。
 * 文档只写了一个 X-Api-Key，所以这里两种都支持：
 *   VOLC_ASR_APP_KEY     —— 应用 ID（控制台叫 APP ID）
 *   VOLC_ASR_ACCESS_KEY  —— 访问密钥，也就是文档说的那个 key
 * 只填了 VOLC_ASR_ACCESS_KEY 的话，X-Api-App-Key 会留空，
 * 若接口报鉴权失败，再把 APP ID 补上即可。
 */

/** 单次上传的音频上限。前端限制了录音时长，这里是第二道闸。 */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** 识别接口自身的超时。超过就让用户重试，不要把请求挂死。 */
const REQUEST_TIMEOUT_MS = 30_000;

export type TranscribeOptions = {
  appKey?: string;
  accessKey?: string;
  resourceId?: string;
  baseUrl?: string;
  /** 识别语种。zh-CN 同时能识别中英混说，符合 StoryVerse 的双语场景。 */
  language?: string;
};

export type TranscribeInput = {
  /** base64 编码的音频。前端用 MediaRecorder 录，通常是 webm/opus。 */
  audioBase64: string;
  /** 音频容器格式，透传给识别接口。 */
  format?: string;
  language?: string;
};

export type TranscribeResult = {
  text: string;
  /** 识别接口给出的置信度，没有就是 undefined，前端不依赖它。 */
  confidence?: number;
  durationMs?: number;
};

const ALLOWED_FORMATS = new Set(["webm", "ogg", "wav", "mp3", "m4a", "pcm"]);

function normalizedFormat(value: string | undefined) {
  const format = (value || "").toLowerCase().trim();
  return ALLOWED_FORMATS.has(format) ? format : "webm";
}

/**
 * 把识别结果里的文本抽出来。
 * 火山不同资源包返回的结构不完全一样（有的在 result.text，有的在
 * result.utterances[].text），所以两种都兜住，避免换资源就整条链路失效。
 */
function extractText(payload: unknown): { text: string; confidence?: number; durationMs?: number } {
  const root = payload as Record<string, any> | null;
  const result = root?.result ?? root?.data?.result ?? root?.data ?? root;
  if (!result) return { text: "" };

  if (typeof result.text === "string" && result.text.trim()) {
    return {
      text: result.text.trim(),
      confidence: typeof result.confidence === "number" ? result.confidence : undefined,
      durationMs: typeof result.duration === "number" ? result.duration : undefined,
    };
  }

  const utterances = Array.isArray(result.utterances) ? result.utterances : [];
  if (utterances.length) {
    const text = utterances
      .map((item: Record<string, any>) => (typeof item?.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("");
    const last = utterances[utterances.length - 1];
    return {
      text: text.trim(),
      durationMs: typeof last?.end_time === "number" ? last.end_time : undefined,
    };
  }
  return { text: "" };
}

export function createTranscriptionService({
  appKey,
  accessKey,
  resourceId = "volc.bigasr.auc_turbo",
  baseUrl = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash",
  language = "zh-CN",
}: TranscribeOptions) {
  return async (input: TranscribeInput): Promise<TranscribeResult> => {
    if (!accessKey) throw new Error("ASR_CONFIG_API_KEY");

    const audioBase64 = (input.audioBase64 || "").trim();
    if (!audioBase64) throw new Error("ASR_AUDIO_EMPTY");
    // base64 每 4 个字符表示 3 字节，估算原始大小，避免先解码再判断。
    if (Math.floor(audioBase64.length * 0.75) > MAX_AUDIO_BYTES) throw new Error("ASR_AUDIO_TOO_LARGE");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(baseUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          // 文档写的是 X-Api-Key，v3 接口实际读的是 X-Api-Access-Key。两个都带上，
          // 哪种命名生效都不影响，省得为了一个头名反复联调。
          "X-Api-Key": accessKey,
          "X-Api-Access-Key": accessKey,
          "X-Api-App-Key": appKey || "",
          "X-Api-Resource-Id": resourceId,
          "X-Api-Request-Id": crypto.randomUUID(),
          "X-Api-Sequence": "-1",
        },
        body: JSON.stringify({
          user: { uid: "storyverse" },
          audio: {
            data: audioBase64,
            format: normalizedFormat(input.format),
          },
          request: {
            model_name: "bigmodel",
            language: input.language || language,
            // 标点交给识别侧加，用户写故事时不用自己补。
            enable_punc: true,
            enable_itn: true,
            show_utterances: true,
          },
        }),
      });
    } catch (error) {
      clearTimeout(timer);
      if ((error as Error)?.name === "AbortError") throw new Error("ASR_TIMEOUT");
      throw new Error("ASR_UNREACHABLE");
    }
    clearTimeout(timer);

    if (response.status === 401 || response.status === 403) throw new Error("ASR_AUTH_FAILED");
    if (response.status === 429) throw new Error("ASR_RATE_LIMITED");
    if (!response.ok) throw new Error("ASR_UPSTREAM_FAILED");

    const payload = await response.json().catch(() => null);
    const extracted = extractText(payload);
    if (!extracted.text) throw new Error("ASR_NO_SPEECH");
    return extracted;
  };
}

export function transcriptionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  switch (message) {
    case "ASR_CONFIG_API_KEY":
      return { status: 503, message: "尚未配置语音识别 API Key。请在服务端设置 VOLC_ASR_ACCESS_KEY。" };
    case "ASR_AUDIO_EMPTY":
      return { status: 400, message: "没有收到音频内容，请重新录一次。" };
    case "ASR_AUDIO_TOO_LARGE":
      return { status: 413, message: "录音太长了，请分段录制。" };
    case "ASR_AUTH_FAILED":
      return { status: 503, message: "语音识别鉴权失败，请检查服务端的 API Key 与 APP ID。" };
    case "ASR_RATE_LIMITED":
      return { status: 429, message: "语音识别调用太频繁了，稍后再试。" };
    case "ASR_TIMEOUT":
      return { status: 504, message: "语音识别超时了，可以重试，也可以直接打字。" };
    case "ASR_NO_SPEECH":
      return { status: 422, message: "这段录音里没有听到清晰的话，可以再录一次。" };
    case "ASR_UNREACHABLE":
      return { status: 502, message: "暂时连不上语音识别服务，可以重试，也可以直接打字。" };
    default:
      return { status: 502, message: "语音转文字失败了，可以重试，也可以直接打字。" };
  }
}
