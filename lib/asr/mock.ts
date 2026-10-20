import type { AsrProvider, AsrRequest, AsrResult } from "./types";

/**
 * 本地联调通道：返回服务端拿到的经文原文，方便把“录音 → 上传 → 比对”整条链路跑通。
 * 生产环境默认禁用（见 config.ts），避免把“永远 100%”的假识别带上线。
 */
export function createMockProvider(): AsrProvider {
  return {
    name: "mock",
    async transcribe(request: AsrRequest): Promise<AsrResult> {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        text: request.referenceText ?? process.env.ASR_MOCK_TEXT ?? "语音识别测试文本",
        provider: "mock",
      };
    },
  };
}
