export type AsrProviderName = "mock" | "tencent" | "step";

/**
 * 只读取开关和是否存在必要配置，不读取密钥内容、不把 key 暴露给客户端。
 * mock 仅允许在非生产环境使用；生产要显式 ASR_ALLOW_MOCK=1 才放行。
 */
export function getAsrProviderName(): AsrProviderName | null {
  const name = process.env.ASR_PROVIDER?.trim().toLowerCase();

  if (name === "mock") {
    if (process.env.NODE_ENV === "production" && process.env.ASR_ALLOW_MOCK !== "1") {
      return null;
    }
    return "mock";
  }

  if (
    name === "tencent" &&
    process.env.TENCENT_SECRET_ID &&
    process.env.TENCENT_SECRET_KEY
  ) {
    return "tencent";
  }

  if (name === "step" && process.env.STEP_API_KEY) {
    return "step";
  }

  return null;
}

export function isAsrEnabled(): boolean {
  return getAsrProviderName() !== null;
}
