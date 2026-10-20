export type AsrErrorCode = "not_configured" | "invalid_audio" | "provider_error";

export class AsrError extends Error {
  readonly code: AsrErrorCode;

  constructor(code: AsrErrorCode, message: string) {
    super(message);
    this.name = "AsrError";
    this.code = code;
  }
}

export interface AsrRequest {
  audio: Buffer;
  mime: string;
  language: string;
  /** 热词数组（各厂商格式在 provider 内转换） */
  hotwords?: string[];
  /** 仅供本地 mock 通道使用；生产 provider 不会拿它参与识别 */
  referenceText?: string;
}

export interface AsrResult {
  text: string;
  provider: string;
  durationMs?: number;
}

export interface AsrProvider {
  name: string;
  transcribe(request: AsrRequest): Promise<AsrResult>;
}
