// 一次性迁移：先查 DB 实际结构，再决定迁移策略
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
  try {
    const tables = await p.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    console.log("TABLES:", JSON.stringify(tables));

    for (const t of ["User", "Card", "Plan", "Feedback", "Verse", "Book", "Note", "Checkin", "Session", "Annotation"]) {
      try {
        const cols = await p.$queryRawUnsafe(`PRAGMA table_info(${t})`);
        console.log(`COLS ${t}:`, JSON.stringify(cols));
      } catch (e) {
        console.log(`COLS ${t}: ERR ${e.message}`);
      }
    }
  } catch (e) {
    console.error("ERR:", e.message);
  } finally {
    await p.$disconnect();
  }
})();
