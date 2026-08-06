// 一次性迁移：把 pre-auth 时代的 DB 升级到多用户 schema
// 1. 创建 User 表 + 插入占位用户
// 2. 创建 Session 表
// 3. 给 Card/Plan/Feedback/Note/Checkin 加 userId 列（NOT NULL DEFAULT 1）
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

async function tableExists(name: string): Promise<boolean> {
  const rows = await p.$queryRawUnsafe<any[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
  );
  return rows.length > 0;
}

async function columnExists(table: string, col: string): Promise<boolean> {
  const cols = await p.$queryRawUnsafe<any[]>(`PRAGMA table_info(${table})`);
  return cols.some((c: any) => c.name === col);
}

(async () => {
  // 1) User 表
  if (!(await tableExists("User"))) {
    await p.$executeRawUnsafe(`
      CREATE TABLE User (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("User table created");
  } else {
    console.log("User table exists");
  }

  // 2) Session 表
  if (!(await tableExists("Session"))) {
    await p.$executeRawUnsafe(`
      CREATE TABLE Session (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        userId INTEGER NOT NULL,
        expiresAt DATETIME NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await p.$executeRawUnsafe(`CREATE INDEX Session_userId_idx ON Session(userId)`);
    console.log("Session table created");
  } else {
    console.log("Session table exists");
  }

  // 3) 占位用户
  const existing = await p.$queryRawUnsafe<any[]>(
    `SELECT id FROM User WHERE id=1`
  );
  if (existing.length === 0) {
    const passwordHash =
      // 与注册时生成的格式兼容：使用 argon2 之外的占位（不会登录）
      "legacy-migration-placeholder";
    await p.$executeRawUnsafe(
      `INSERT INTO User (id, username, name, passwordHash, role) VALUES (1, 'legacy', '历史数据占位', ?, 'user')`
    );
    console.log("Placeholder User (id=1) created");
  } else {
    console.log("User id=1 exists");
  }

  // 4) 给老表加 userId
  const tables = ["Card", "Plan", "Feedback", "Note", "Checkin"];
  for (const t of tables) {
    if (await columnExists(t, "userId")) {
      console.log(`${t}.userId already exists`);
    } else {
      await p.$executeRawUnsafe(
        `ALTER TABLE ${t} ADD COLUMN userId INTEGER NOT NULL DEFAULT 1`
      );
      console.log(`${t}.userId added (default 1)`);
    }
  }

  console.log("Migration complete.");
  await p.$disconnect();
})();
