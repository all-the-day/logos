/**
 * 一次性迁移：把已存在 Card 的 stability/difficulty 默认值对齐到 FSRS 标准。
 * 历史 schema 默认值是 (2.5, 0.3)，新版改为 (2.0, 5.0)。
 *
 * 运行方式：DATABASE_URL=file:./prisma/dev.db npx tsx prisma/migrate-fix-card-defaults.ts
 * 仅影响 state='new' 且 stability=2.5 / difficulty=0.3 的卡（识别历史默认值）
 */
import { prisma } from "../lib/prisma";

async function main() {
  const historical = await prisma.card.findMany({
    where: {
      state: "new",
      stability: 2.5,
      difficulty: 0.3,
    },
    select: { id: true },
  });

  if (historical.length === 0) {
    console.log("✅ 无需迁移，无历史默认值的卡片");
    return;
  }

  const result = await prisma.card.updateMany({
    where: {
      id: { in: historical.map((c) => c.id) },
    },
    data: { stability: 2.0, difficulty: 5.0 },
  });

  console.log(`✅ 已迁移 ${result.count} 张卡片到新默认值 (stability=2.0, difficulty=5.0)`);
}

main()
  .catch((e) => {
    console.error("迁移失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
