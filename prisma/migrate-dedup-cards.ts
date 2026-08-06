// 一次性去重：每个 (userId, verseId) 只保留一张卡
// 保留策略：保留 id 最大（最新）的卡；其他删除
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

try {
  const envText = readFileSync(".env", "utf-8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
} catch {}

const p = new PrismaClient();

(async () => {
  // 1. 找重复 (userId, verseId) 中应保留的 ID（最大）
  const keepers = await p.$queryRawUnsafe<any[]>(
    `SELECT MAX(id) as id, userId, verseId FROM Card GROUP BY userId, verseId`
  );
  const keepIds = keepers.map((r: any) => r.id);

  // 2. 找应删除的 ID
  const allIds = await p.$queryRawUnsafe<any[]>(
    `SELECT id, userId, verseId FROM Card`
  );
  const allIdSet = new Set(allIds.map((r: any) => r.id));
  const keepIdSet = new Set(keepIds);
  const deleteIds = allIds
    .filter((r: any) => !keepIdSet.has(r.id))
    .map((r: any) => r.id);

  console.log(`Total cards: ${allIds.length}`);
  console.log(`Keep: ${keepIds.length}`);
  console.log(`Delete: ${deleteIds.length}`);

  if (deleteIds.length === 0) {
    console.log("No duplicates to delete");
    await p.$disconnect();
    return;
  }

  // 3. 批量删除（分批避免 SQLite 参数限制）
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += BATCH) {
    const batch = deleteIds.slice(i, i + BATCH);
    const placeholders = batch.map(() => "?").join(",");
    const r = await p.$executeRawUnsafe(
      `DELETE FROM Card WHERE id IN (${placeholders})`,
      ...batch
    );
    deleted += Number(r);
  }
  console.log(`Deleted ${deleted} duplicate cards`);
  console.log(`Remaining: ${allIds.length - deleted}`);

  await p.$disconnect();
})();
