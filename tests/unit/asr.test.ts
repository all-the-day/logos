import { afterEach, describe, expect, it, vi } from "vitest";
import { parseWav } from "@/lib/asr/wav";
import { buildHotwordList, buildHotwordWords, formatTencentHotwords } from "@/lib/asr/hotwords";
import { checkRateLimit, resetRateLimits } from "@/lib/asr/rate-limit";
import { getAsrProviderName } from "@/lib/asr/config";
import { createMockProvider } from "@/lib/asr/mock";
import { createStepProvider } from "@/lib/asr/step";
import { parseSseEventBlock } from "@/lib/asr/step";

function makeWav(options?: {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  seconds?: number;
  audioFormat?: number;
  truncateData?: boolean;
}): Uint8Array {
  const {
    sampleRate = 16000,
    channels = 1,
    bitsPerSample = 16,
    seconds = 1,
    audioFormat = 1,
    truncateData = false,
  } = options ?? {};

  const frames = Math.max(1, Math.round(sampleRate * seconds));
  const dataSize = frames * channels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, audioFormat, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);

  const bytes = new Uint8Array(buffer);
  return truncateData ? bytes.slice(0, 44 + Math.floor(dataSize / 2)) : bytes;
}

describe("parseWav", () => {
  it("接受 16k/单声道/16bit WAV 并计算时长", () => {
    const result = parseWav(makeWav({ seconds: 1.5 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.info.durationSec).toBeCloseTo(1.5, 2);
    expect(result.info.sampleRate).toBe(16000);
    expect(result.info.channels).toBe(1);
  });

  it("拒绝非 WAV / 非 PCM / 立体声 / 8k", () => {
    expect(parseWav(new Uint8Array(60)).ok).toBe(false);
    expect(parseWav(makeWav({ audioFormat: 3 })).ok).toBe(false);
    expect(parseWav(makeWav({ channels: 2 })).ok).toBe(false);
    expect(parseWav(makeWav({ sampleRate: 8000 })).ok).toBe(false);
  });

  it("拒绝被截断的 data 块", () => {
    const result = parseWav(makeWav({ truncateData: true }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("不完整");
  });

  it("能解析超过 60 秒的音频，时长由路由层拒绝", () => {
    const result = parseWav(makeWav({ seconds: 61 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.info.durationSec).toBeGreaterThan(60);
  });
});

describe("buildHotwordList", () => {
  it("书卷名权重 10，其余为 5，去重且不超过 128 个", () => {
    const list = buildHotwordList("罗马书");
    const items = list.split(",");
    expect(items[0]).toBe("罗马书|10");
    expect(items.length).toBeLessThanOrEqual(128);
    expect(new Set(items.map((item) => item.split("|")[0])).size).toBe(items.length);
    for (const item of items) {
      expect(item).toMatch(/^[^,|]+\|\d+$/);
    }
  });

  it("不传书卷名时仍返回固定热词", () => {
    const items = buildHotwordList().split(",");
    expect(items).toContain("耶和华|5");
    expect(items).toContain("祂|5");
  });

  it("buildHotwordWords 返回数组，formatTencentHotwords 输出腾讯格式", () => {
    const words = buildHotwordWords("罗马书");
    expect(words[0]).toBe("罗马书");
    const formatted = formatTencentHotwords(words, 10).split(",");
    expect(formatted[0]).toBe("罗马书|10");
    expect(formatted[1]).toBe("耶和华|5");
    expect(words.length).toBeLessThanOrEqual(128);
  });
});

describe("StepAudio SSE 解析", () => {
  it("解析 delta / done / error 事件", () => {
    expect(
      parseSseEventBlock('data: {"type":"transcript.text.delta","delta":"你好"}')
    ).toEqual({ type: "transcript.text.delta", delta: "你好" });

    expect(
      parseSseEventBlock('data: {"type":"transcript.text.done","text":"完整文本"}')
    ).toEqual({ type: "transcript.text.done", text: "完整文本" });

    expect(
      parseSseEventBlock('data: {"type":"error","message":"boom"}')
    ).toEqual({ type: "error", message: "boom" });
  });

  it("忽略无 data / 非法 JSON 的事件块", () => {
    expect(parseSseEventBlock("event: ping")).toBeNull();
    expect(parseSseEventBlock("data: not-json")).toBeNull();
  });
});

describe("checkRateLimit", () => {
  afterEach(resetRateLimits);

  it("每分钟最多 10 次，超限返回重试秒数", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(1, now + i).allowed).toBe(true);
    }
    const blocked = checkRateLimit(1, now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("窗口滑过后恢复，且不同用户互不影响", () => {
    const now = 2_000_000;
    for (let i = 0; i < 10; i++) checkRateLimit(1, now + i);
    expect(checkRateLimit(1, now + 10).allowed).toBe(false);
    expect(checkRateLimit(2, now + 10).allowed).toBe(true);
    expect(checkRateLimit(1, now + 60_001).allowed).toBe(true);
  });
});

describe("getAsrProviderName", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("未配置时返回 null", () => {
    vi.stubEnv("ASR_PROVIDER", "");
    expect(getAsrProviderName()).toBeNull();
  });

  it("mock 在非生产环境可用", () => {
    vi.stubEnv("ASR_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "test");
    expect(getAsrProviderName()).toBe("mock");
  });

  it("tencent 缺密钥时返回 null，齐全时返回 tencent", () => {
    vi.stubEnv("ASR_PROVIDER", "tencent");
    vi.stubEnv("TENCENT_SECRET_ID", "");
    vi.stubEnv("TENCENT_SECRET_KEY", "");
    expect(getAsrProviderName()).toBeNull();

    vi.stubEnv("TENCENT_SECRET_ID", "id");
    vi.stubEnv("TENCENT_SECRET_KEY", "key");
    expect(getAsrProviderName()).toBe("tencent");
  });

  it("step 缺 key 返回 null，有 key 返回 step", () => {
    vi.stubEnv("ASR_PROVIDER", "step");
    vi.stubEnv("STEP_API_KEY", "");
    expect(getAsrProviderName()).toBeNull();

    vi.stubEnv("STEP_API_KEY", "sk-xxx");
    expect(getAsrProviderName()).toBe("step");
  });
});

describe("createMockProvider", () => {
  it("返回传入的经文原文，供本地端到端联调", async () => {
    const provider = createMockProvider();
    const result = await provider.transcribe({
      audio: Buffer.alloc(0),
      mime: "audio/wav",
      language: "zh-CN",
      referenceText: "太初有道",
    });
    expect(result.text).toBe("太初有道");
    expect(result.provider).toBe("mock");
  });
});

describe("createStepProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function sseResponse(chunks: string[]) {
    const encoder = new TextEncoder();
    return {
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      }),
    };
  }

  it("按 done 事件返回最终文本，并发送 base64/hotwords/enable_itn=false", async () => {
    vi.stubEnv("STEP_API_KEY", "sk-test");
    vi.stubEnv("STEP_API_BASE", "https://api.stepfun.com");
    const fetchMock = vi.fn(async () =>
      sseResponse([
        'data: {"type":"transcript.text.delta","delta":"基督耶稣"}\n\n',
        'data: {"type":"transcript.text.done","text":"基督耶稣的奴仆保罗"}\n\n',
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createStepProvider().transcribe({
      audio: Buffer.from("abc"),
      mime: "audio/wav",
      language: "zh-CN",
      hotwords: ["罗马书"],
    });

    expect(result.text).toBe("基督耶稣的奴仆保罗");
    expect(result.provider).toBe("step");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stepfun.com/v1/audio/asr/sse");
    const body = JSON.parse(String(init.body));
    expect(body.audio.data).toBe(Buffer.from("abc").toString("base64"));
    expect(body.audio.input.format.type).toBe("wav");
    expect(body.audio.input.transcription.hotwords).toEqual(["罗马书"]);
    expect(body.audio.input.transcription.enable_itn).toBe(false);
    expect(body.audio.input.transcription.model).toBe("stepaudio-3-asr-max");
  });

  it("Step Plan 前缀默认走 step_plan 路径与 2.5 模型", async () => {
    vi.stubEnv("STEP_API_KEY", "sk-test");
    vi.stubEnv("STEP_API_BASE", "https://api.stepfun.com/step_plan");
    vi.stubEnv("STEP_ASR_MODEL", "");
    const fetchMock = vi.fn(async () =>
      sseResponse(['data: {"type":"transcript.text.done","text":"太初有道"}\n\n'])
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createStepProvider().transcribe({
      audio: Buffer.from("abc"),
      mime: "audio/wav",
      language: "zh-CN",
    });

    expect(result.text).toBe("太初有道");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stepfun.com/step_plan/v1/audio/asr/sse");
    const body = JSON.parse(String(init.body));
    expect(body.audio.input.transcription.model).toBe("stepaudio-2.5-asr");
  });

  it("只有 delta 时返回拼接文本", async () => {
    vi.stubEnv("STEP_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'data: {"type":"transcript.text.delta","delta":"太初"}\n\n',
          'data: {"type":"transcript.text.delta","delta":"有道"}\n\n',
        ])
      )
    );

    const result = await createStepProvider().transcribe({
      audio: Buffer.from("abc"),
      mime: "audio/wav",
      language: "zh-CN",
    });
    expect(result.text).toBe("太初有道");
  });

  it("error 事件收敛为 provider_error", async () => {
    vi.stubEnv("STEP_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse(['data: {"type":"error","message":"boom"}\n\n']))
    );

    await expect(
      createStepProvider().transcribe({
        audio: Buffer.from("abc"),
        mime: "audio/wav",
        language: "zh-CN",
      })
    ).rejects.toMatchObject({ code: "provider_error" });
  });
});
