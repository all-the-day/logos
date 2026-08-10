/**
 * 重置测试数据库 prisma/test.db
 *
 * 安全约束（硬保护，防止误删 dev.db / 生产库）：
 * 1. 解析后的目标路径必须严格等于 <项目根>/prisma/test.db
 * 2. 只允许操作 basename === "test.db" 且位于 prisma/ 目录下的文件
 * 3. 明确拒绝 dev.db
 *
 * 步骤：删除 test.db(+journal/wal/shm) → 用显式 DATABASE_URL 执行 prisma db push
 * → 通过 Prisma $queryRaw 校验表结构。
 *
 * 仅依赖 node:fs / node:child_process / @prisma/client，不依赖 node:sqlite
 * （@types/node@20 无其类型，Node 20 运行时亦不可用）。
 *
 * 用法：npm run test:db:reset
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TARGET_DB = resolve(PROJECT_ROOT, "prisma", "test.db");
const PRISMA_DIR = resolve(PROJECT_ROOT, "prisma");

function assertSafe() {
  const expected = resolve(PRISMA_DIR, "test.db");
  if (TARGET_DB !== expected) {
    throw new Error(`内部错误：目标路径计算不一致 (${TARGET_DB})`);
  }
  if (basename(TARGET_DB) !== "test.db") {
    throw new Error(`拒绝操作：只允许重置 test.db，实际为 ${basename(TARGET_DB)}`);
  }
  if (dirname(TARGET_DB) !== PRISMA_DIR) {
    throw new Error(`拒绝操作：test.db 必须位于 prisma/ 目录，实际为 ${dirname(TARGET_DB)}`);
  }
  if (TARGET_DB.endsWith("dev.db")) {
    throw new Error("拒绝操作：严禁重置 dev.db");
  }
}

function removeTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TARGET_DB + suffix;
    if (existsSync(p)) rmSync(p);
  }
}

function pushSchema() {
  // execSync 在子进程非零退出时抛错，天然以退出码判断成功
  execSync("npx prisma db push --skip-generate", {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}

async function verify() {
  process.env.DATABASE_URL = "file:./test.db";
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const tables = (await prisma.$queryRaw`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `) as Array<{ name: string }>;
    console.log(
      `测试库就绪：${TARGET_DB}\n表 (${tables.length} 张)：${tables.map((t) => t.name).join(", ")}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assertSafe();
  removeTestDbFiles();
  pushSchema();
  await verify();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
