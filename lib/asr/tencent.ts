import { asr } from "tencentcloud-sdk-nodejs-asr";
import { formatTencentHotwords } from "./hotwords";
import { AsrError, type AsrProvider, type AsrRequest, type AsrResult } from "./types";

let client: InstanceType<typeof asr.v20190614.Client> | null = null;

function getClient(): InstanceType<typeof asr.v20190614.Client> {
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new AsrError("not_configured", "语音识别未配置");
  }

  if (!client) {
    client = new asr.v20190614.Client({
      credential: { secretId, secretKey },
      region: process.env.TENCENT_REGION || "ap-guangzhou",
      profile: {
        httpProfile: {
          endpoint: "asr.tencentcloudapi.com",
          reqTimeout: 20,
        },
      },
    });
  }

  return client;
}

export function createTencentProvider(): AsrProvider {
  return {
    name: "tencent",
    async transcribe(request: AsrRequest): Promise<AsrResult> {
      try {
        const response = await getClient().SentenceRecognition({
          EngSerViceType: process.env.TENCENT_ASR_ENGINE || "16k_zh",
          SourceType: 1,
          VoiceFormat: "wav",
          Data: request.audio.toString("base64"),
          DataLen: request.audio.byteLength,
          // 标点不参与比对，直接过滤；不要过滤语气词/脏词，避免误删经文本字
          FilterPunc: 2,
          FilterModal: 0,
          FilterDirty: 0,
          // 保留中文数字（如“三”“十二”），避免转成阿拉伯数字后与经文原文不一致
          ConvertNumMode: 0,
          ...(request.hotwords && request.hotwords.length
            ? { HotwordList: formatTencentHotwords(request.hotwords) }
            : {}),
        });

        const text = (response.Result ?? "").trim();
        if (!text) {
          throw new AsrError("provider_error", "语音识别没有返回内容");
        }

        return {
          text,
          provider: "tencent",
          durationMs: response.AudioDuration,
        };
      } catch (error) {
        if (error instanceof AsrError) throw error;
        // 不记录音频与识别文本；只把厂商错误收敛成通用错误，避免泄露内部信息
        throw new AsrError("provider_error", "语音识别服务暂时不可用");
      }
    },
  };
}
