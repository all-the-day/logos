/**
 * 测试进程级 DATABASE_URL 安全校验。
 * 在 worker 启动时执行（setupFiles），防止测试进程误连 prisma/dev.db 或生产库。
 * 注意：重置脚本（reset-test-db.ts）有自己的路径保护；这里是进程侧的独立防线。
 */
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXPECTED_URL = "file:./test.db";

export function setup() {
  const url = process.env.DATABASE_URL;
  if (url !== EXPECTED_URL) {
    throw new Error(
      `测试进程 DATABASE_URL 必须为 "${EXPECTED_URL}"（指向 prisma/test.db），当前为 "${url ?? "未设置"}"。` +
        "请通过 npm run test / npm run test:coverage 运行，勿直接调用 npx vitest。"
    );
  }

  const expectedDb = resolve(PROJECT_ROOT, "prisma", "test.db");
  if (
    basename(expectedDb) !== "test.db" ||
    dirname(expectedDb) !== resolve(PROJECT_ROOT, "prisma")
  ) {
    throw new Error(`测试数据库路径解析异常：${expectedDb}`);
  }
}
