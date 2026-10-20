/**
 * WAV 头解析（服务端校验用，不依赖 Node Buffer）。
 * 只接受 16kHz、单声道、16bit PCM——与客户端的转码结果和腾讯云 16k_zh 引擎一致。
 */

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSec: number;
  dataSize: number;
}

export type WavParseResult =
  | { ok: true; info: WavInfo }
  | { ok: false; reason: string };

const TARGET_SAMPLE_RATE = 16000;

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

export function parseWav(bytes: Uint8Array): WavParseResult {
  if (bytes.byteLength < 44) {
    return { ok: false, reason: "音频文件过短" };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (fourCC(bytes, 0) !== "RIFF" || fourCC(bytes, 8) !== "WAVE") {
    return { ok: false, reason: "不是有效的 WAV 文件" };
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataSize: number | null = null;
  let dataOffset = 0;

  while (offset + 8 <= bytes.byteLength) {
    const id = fourCC(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === "fmt ") {
      if (size < 16 || body + 16 > bytes.byteLength) {
        return { ok: false, reason: "WAV 格式块不完整" };
      }
      audioFormat = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === "data") {
      dataOffset = body;
      dataSize = size;
      // data 块可能不是最后一个块；继续扫描以兼容带 LIST 的 WAV
    }

    const next = body + size + (size % 2);
    if (next <= offset) break; // 防止异常 size 造成死循环
    offset = next;
  }

  if (audioFormat !== 1) {
    return { ok: false, reason: "只支持 PCM WAV" };
  }
  if (channels !== 1) {
    return { ok: false, reason: "只支持单声道音频" };
  }
  if (sampleRate !== TARGET_SAMPLE_RATE) {
    return { ok: false, reason: "采样率必须为 16000Hz" };
  }
  if (bitsPerSample !== 16) {
    return { ok: false, reason: "只支持 16bit 音频" };
  }
  if (dataSize === null || dataSize <= 0) {
    return { ok: false, reason: "WAV 没有音频数据" };
  }
  if (dataOffset + dataSize > bytes.byteLength) {
    return { ok: false, reason: "WAV 音频数据不完整" };
  }

  const bytesPerFrame = channels * (bitsPerSample / 8);
  const durationSec = dataSize / (sampleRate * bytesPerFrame);

  return {
    ok: true,
    info: { sampleRate, channels, bitsPerSample, durationSec, dataSize },
  };
}
