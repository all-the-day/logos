/**
 * 客户端录音与 16k 单声道 WAV 转码。
 * 录音用 MediaRecorder（webm/opus 等），转码用 Web Audio API，
 * 这样腾讯/阿里/讯飞等在线 API 都能直接接收，不必在服务器装 ffmpeg。
 */

export const MAX_RECORD_SECONDS = 60;
const TARGET_SAMPLE_RATE = 16000;

export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  cancel(): void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function getRecordingSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export function createRecorder(): Recorder {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];

  function cleanup() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
    chunks = [];
  }

  return {
    async start() {
      if (!getRecordingSupport()) {
        throw new Error("当前浏览器不支持录音，请使用文字输入");
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = pickMimeType();
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.start(250);
    },

    stop() {
      return new Promise<Blob>((resolve, reject) => {
        const active = recorder;
        if (!active) {
          reject(new Error("录音尚未开始"));
          return;
        }

        active.onerror = () => {
          cleanup();
          reject(new Error("录音失败，请重试"));
        };
        active.onstop = () => {
          const blob = new Blob(chunks, { type: active.mimeType || "audio/webm" });
          cleanup();
          resolve(blob);
        };

        if (active.state === "inactive") {
          const blob = new Blob(chunks, { type: active.mimeType || "audio/webm" });
          cleanup();
          resolve(blob);
          return;
        }
        active.stop();
      });
    },

    cancel() {
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        // 忽略停止时的异常，继续释放麦克风
      }
      cleanup();
    },
  };
}

function downmixToMono(buffer: AudioBuffer, context: BaseAudioContext): AudioBuffer {
  if (buffer.numberOfChannels === 1) return buffer;

  const mono = context.createBuffer(1, buffer.length, buffer.sampleRate);
  const out = mono.getChannelData(0);
  const channelCount = buffer.numberOfChannels;

  for (let channel = 0; channel < channelCount; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      out[i] += data[i] / channelCount;
    }
  }

  return mono;
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const samples = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const dataSize = samples.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return arrayBuffer;
}

export async function convertToWav(blob: Blob): Promise<Blob> {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("当前浏览器不支持音频转码，请使用文字输入");
  }

  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const mono = downmixToMono(decoded, context);
    const frames = Math.max(1, Math.ceil(mono.duration * TARGET_SAMPLE_RATE));

    const OfflineContextCtor =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!OfflineContextCtor) {
      throw new Error("当前浏览器不支持音频转码，请使用文字输入");
    }

    const offline = new OfflineContextCtor(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = mono;
    source.connect(offline.destination);
    source.start();

    const rendered = await offline.startRendering();
    return new Blob([encodeWav(rendered)], { type: "audio/wav" });
  } finally {
    await context.close().catch(() => undefined);
  }
}
