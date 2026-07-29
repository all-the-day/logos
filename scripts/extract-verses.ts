/**
 * 从 bible 项目抽取书卷经文 → public/data/
 * 使用 TypeScript + sql.js（纯 JS SQLite 实现，无需 native 依赖）
 *
 * 用法：npx tsx scripts/extract-verses.ts [书卷索引 ...]
 *   npx tsx scripts/extract-verses.ts              # 默认：罗马书、约翰一书
 *   npx tsx scripts/extract-verses.ts 45 46 47     # 抽取指定书卷
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const PYTHON_SCRIPT = resolve(
  __dirname,
  "../../bible-memorize/scripts/extract_verses.py"
);

// 直接复用 bible-memorize 的 Python 提取脚本，输出到 logos/public/data/
const LOGOS_OUT = resolve(__dirname, "../public/data");

const args = process.argv.slice(2);
console.log("Extracting verses from bible project...");
console.log(`Output: ${LOGOS_OUT}`);

// Create output directory
if (!existsSync(LOGOS_OUT)) {
  const { mkdirSync } = require("fs");
  mkdirSync(LOGOS_OUT, { recursive: true });
}

try {
  const result = execSync(
    `python "${PYTHON_SCRIPT}" ${args.join(" ")}`,
    {
      env: {
        ...process.env,
        OUT_DIR: LOGOS_OUT,
      },
      encoding: "utf-8",
    }
  );
  console.log(result);
} catch (error) {
  console.error("Extraction failed:", error);
  process.exit(1);
}
