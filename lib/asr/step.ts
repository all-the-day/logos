import { AsrError, type AsrProvider, type AsrRequest, type AsrResult } from "./types";

/**
 * 阶跃星辰 StepAudio 3 ASR（HTTP + SSE）。
 * 文档：https://platform.stepfun.com/docs/zh/api-reference/audio/asr-sse
 * - Step Plan 场景用 https://api.stepfun.com/step_plan/v1/audio/asr/sse
 * - 音频走 Base64；wav 16k 单声道 16bit 直接支持
 * - hotwords 数组 + language=zh；enable_itn=false 保留中文数字
 */

interface StepSseEvent {
  type?: string;
  delta?: string;
  text?: string;
  message?: string;
}

/** 解析单个 SSE 事件块（供测试与流式循环复用） */
export function parseSseEventBlock(block: string): StepSseEvent | null {
  const dataLines: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;

  try {
    return JSON.parse(dataLines.join("\n")) as StepSseEvent;
  } catch {
    return null;
  }
}

export function createStepProvider(): AsrProvider {
  return {
    name: "step",
    async transcribe(request: AsrRequest): Promise<AsrResult> {
      const apiKey = process.env.STEP_API_KEY;
      if (!apiKey) {
        throw new AsrError("not_configured", "语音识别未配置");
      }

      const base = (process.env.STEP_API_BASE || "https://api.stepfun.com").replace(/\/+$/, "");
      const path = process.env.STEP_ASR_PATH || "/v1/audio/asr/sse";
      // Step Plan 走 /step_plan/v1 前缀，文档示例模型为 stepaudio-2.5-asr；
      // 普通域名默认用更强的 stepaudio-3-asr-max。都可用 STEP_ASR_MODEL 覆盖。
      const model =
        process.env.STEP_ASR_MODEL ||
        (base.includes("/step_plan") ? "stepaudio-2.5-asr" : "stepaudio-3-asr-max");
      const timeoutMs = Number(process.env.STEP_ASR_TIMEOUT_MS || 30_000);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${base}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            audio: {
              data: request.audio.toString("base64"),
              input: {
                transcription: {
                  language: request.language || "zh",
                  hotwords: request.hotwords ?? [],
                  model,
                  // 关闭数字智能转换，保留“三”“十二”等中文数字，避免与经文原文不一致
                  enable_itn: false,
                  enable_timestamp: false,
                },
                format: {
                  type: "wav",
                  codec: "pcm_s16le",
                  rate: 16000,
                  bits: 16,
                  channel: 1,
                },
              },
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new AsrError("provider_error", "语音识别服务暂时不可用");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamed = "";
        let finalText = "";

        const handleBlock = (block: string) => {
          const event = parseSseEventBlock(block);
          if (!event) return;
          if (event.type === "transcript.text.delta") {
            streamed += event.delta ?? "";
          } else if (event.type === "transcript.text.done") {
            finalText = (event.text ?? "").trim();
          } else if (event.type === "error") {
            throw new AsrError("provider_error", "语音识别服务暂时不可用");
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? "";
          for (const block of blocks) handleBlock(block);
        }

        buffer += decoder.decode();
        if (buffer.trim()) handleBlock(buffer);

        const text = (finalText || streamed).trim();
        if (!text) {
          throw new AsrError("provider_error", "语音识别没有返回内容");
        }

        return { text, provider: "step" };
      } catch (error) {
        if (error instanceof AsrError) throw error;
        // 超时/网络错误统一收敛，不记录音频与识别文本
        throw new AsrError("provider_error", "语音识别服务暂时不可用");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
