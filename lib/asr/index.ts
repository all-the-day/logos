import { getAsrProviderName } from "./config";
import { createMockProvider } from "./mock";
import { createStepProvider } from "./step";
import { createTencentProvider } from "./tencent";
import type { AsrProvider } from "./types";

export { AsrError } from "./types";
export type { AsrProvider, AsrRequest, AsrResult } from "./types";

export function getAsrProvider(): AsrProvider | null {
  const name = getAsrProviderName();
  if (!name) return null;
  if (name === "mock") return createMockProvider();
  if (name === "step") return createStepProvider();
  return createTencentProvider();
}
