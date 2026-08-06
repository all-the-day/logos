// 一次性迁移：给老表补 userId 列并指向第一个用户
// 仅在 "Added the required column `userId`" 报错时执行
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // 找到第一个用户（新数据归它）
  const firstUser = await p.user.findFirst({ orderBy: { id: "asc" } });
  if (!firstUser) {
    throw new Error("无用户存在，请先创建用户再迁移");
  }
  const uid = firstUser.id;
  console.log(`Will assign userId=${uid} (${firstUser.username}) to legacy rows`);

  const tables = ["Card", "Plan", "Feedback"];
  for (const t of tables) {
    try {
      await p.$executeRawUnsafe(
        `ALTER TABLE ${t} ADD COLUMN userId INTEGER NOT NULL DEFAULT ${uid}`
      );
      console.log(`${t}.userId added (default ${uid})`);
    } catch (e) {
      if (e.message.includes("duplicate column")) {
        console.log(`${t}.userId already exists`);
      } else {
        throw e;
      }
    }
  }

  const cards = await p.card.count();
  const plans = await p.plan.count();
  console.log(`Migration done. Cards: ${cards}, Plans: ${plans}`);

  await p.$disconnect();
})();
