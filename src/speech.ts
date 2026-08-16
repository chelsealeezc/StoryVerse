/**
 * 浏览器端录音 + 调用后端识别。
 *
 * 识别本身在服务端做（server/speech-to-text.ts），这里只负责：
 *   1. 申请麦克风权限、录一段音
 *   2. 转成 base64 交给 /api/transcribe
 *   3. 把文本还给调用方
 *
 * 刻意没有用浏览器自带的 SpeechRecognition：Chrome 的实现会把音频发到 Google，
 * 国内不可用，Safari/Firefox 支持也不一致。走后端只依赖 MediaRecorder，
 * 各浏览器行为一致，也符合"用户数据只经过我们自己选定的服务商"。
 */

/** 单段录音上限。超过就自动停止，避免录出一个传不上去的大文件。 */
export const MAX_RECORDING_MS = 60_000;

export type RecordingHandle = {
  /** 停止录音并返回识别出的文字。 */
  stop: () => Promise<string>;
  /** 放弃这次录音，不发请求。 */
  cancel: () => void;
};

export class SpeechError extends Error {
  constructor(message: string, readonly kind: "permission" | "unsupported" | "network" | "empty") {
    super(message);
    this.name = "SpeechError";
  }
}

/** 挑一个当前浏览器支持的录音格式，顺带告诉后端容器类型。 */
function pickMimeType() {
  const candidates = [
    { mime: "audio/webm;codecs=opus", format: "webm" },
    { mime: "audio/webm", format: "webm" },
    { mime: "audio/ogg;codecs=opus", format: "ogg" },
    { mime: "audio/mp4", format: "m4a" },
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
  }
  return null;
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new SpeechError("读取录音失败", "empty"));
    reader.onload = () => {
      const result = String(reader.result || "");
      // FileReader 给的是 data:audio/webm;base64,xxxx，只要逗号后面那段
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function transcribe(audioBase64: string, format: string, language: string) {
  const endpoint = import.meta.env.VITE_TRANSCRIBE_API_URL || "/api/transcribe";
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, format, language }),
    });
  } catch {
    throw new SpeechError("暂时连不上语音识别服务，可以重试，也可以直接打字。", "network");
  }
  const payload = await response.json().catch(() => ({})) as {
    data?: { text?: string };
    text?: string;
    error?: string | { message?: string };
  };
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : payload.error?.message;
    throw new SpeechError(message || "语音转文字失败了，可以重试，也可以直接打字。", "network");
  }
  const text = payload.data?.text ?? payload.text ?? "";
  if (!text.trim()) throw new SpeechError("这段录音里没有听到清晰的话，可以再录一次。", "empty");
  return text.trim();
}

/**
 * 开始录音。返回的 handle 上调 stop() 拿文字，或调 cancel() 丢弃。
 * language 传界面当前语言即可 —— zh-CN 也能识别中英混说。
 */
export async function startRecording(language: "zh" | "en"): Promise<RecordingHandle> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new SpeechError("这个浏览器不支持录音，可以直接打字。", "unsupported");
  }
  const picked = pickMimeType();
  if (!picked) throw new SpeechError("这个浏览器不支持录音，可以直接打字。", "unsupported");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new SpeechError("没有拿到麦克风权限。可以在浏览器地址栏右侧允许后重试。", "permission");
  }

  const recorder = new MediaRecorder(stream, { mimeType: picked.mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
  recorder.start();

  // 录音轨道一定要显式关掉，否则浏览器标签页上的录音指示灯会一直亮着
  const releaseMic = () => stream.getTracks().forEach(track => track.stop());
  const autoStop = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, MAX_RECORDING_MS);

  const stopped = new Promise<Blob>(resolve => {
    recorder.onstop = () => {
      window.clearTimeout(autoStop);
      releaseMic();
      resolve(new Blob(chunks, { type: picked.mime }));
    };
  });

  let cancelled = false;
  return {
    stop: async () => {
      if (recorder.state === "recording") recorder.stop();
      const blob = await stopped;
      if (cancelled) return "";
      if (blob.size === 0) throw new SpeechError("没有录到声音，可以再试一次。", "empty");
      return transcribe(await blobToBase64(blob), picked.format, language === "zh" ? "zh-CN" : "en-US");
    },
    cancel: () => {
      cancelled = true;
      window.clearTimeout(autoStop);
      if (recorder.state === "recording") recorder.stop();
      releaseMic();
    },
  };
}
