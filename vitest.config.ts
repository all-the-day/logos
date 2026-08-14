import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: { jsx: "automatic" }, // 与 Next.js 的 JSX 运行时保持一致（组件无需手动 import React）
  test: {
    environment: "node",
    // 业务时区固定为 Asia/Shanghai（避免开发机/服务器时区差异影响日期类断言）
    // DATABASE_URL 固定指向 prisma/test.db；由 tests/fixtures/setup.ts 再做精确校验
    env: {
      TZ: "Asia/Shanghai",
      DATABASE_URL: "file:./test.db",
    },
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/fixtures/setup.ts"],
    // SQLite 单 worker 串行执行，避免写锁竞争
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: [
        "lib/fsrs.ts",
        "lib/compare.ts",
        "lib/date.ts",
        "services/learn.ts",
        "db/card.ts",
      ],
    },
  },
});
