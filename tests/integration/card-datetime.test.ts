import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCards, updateCard } from "@/db/card";
import { clearDb, FIXED_NOW } from "@/tests/fixtures/seed-test";

const DAY_MS = 86400000;

type StorageRow = { id: number; dueType: string; lastReviewType: string };

async function seedUsersVerses() {
  await clearDb();
  await prisma.user.create({ data: { id: 1, username: "alice", name: "爱丽丝", passwordHash: "x" } });
  await prisma.book.create({ data: { id: 1, name: "测试卷一", chapters: 1 } });
  await prisma.verse.createMany({
    data: [
      { id: 101, bookId: 1, chapter: 1, verse: 1, content: "经101", kjv: null },
      { id: 102, bookId: 1, chapter: 1, verse: 2, content: "经102", kjv: null },
      { id: 103, bookId: 1, chapter: 1, verse: 3, content: "经103", kjv: null },
    ],
  });
}

async function storageTypes(): Promise<Map<number, StorageRow>> {
  const rows = (await prisma.$queryRaw`
    SELECT id, typeof(due) AS dueType, typeof(lastReview) AS lastReviewType
    FROM Card ORDER BY id
  `) as StorageRow[];
  return new Map(rows.map((r) => [r.id, r]));
}

describe("Card DateTime 存储一致性", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
  });
  afterAll(() => vi.useRealTimers());
  beforeEach(async () => {
    await seedUsersVerses();
  });

  it("诊断根因：createMany / create / updateMany 的 due 存储类型", async () => {
    await createCards(1, [101, 102]); // createMany（无显式 due，走 @default(now())）
    const [c101, c102] = await prisma.card.findMany({ where: { userId: 1 }, orderBy: { verseId: "asc" } });

    const c103 = await prisma.card.create({
      data: {
        userId: 1, verseId: 103,
        due: new Date(FIXED_NOW.getTime() - DAY_MS),
        stability: 2, difficulty: 5,
      },
    });

    // 模拟评分更新路径（updateMany + Date）
    await updateCard(c101.id, 1, {
      due: new Date(FIXED_NOW.getTime() + 1 * DAY_MS),
      lastReview: FIXED_NOW,
      stability: 5, difficulty: 4, reps: 1, lapses: 0, state: "learning",
    });

    const types = await storageTypes();
    console.log("存储类型诊断:", {
      createManyDefault: { due: types.get(c102.id)?.dueType, lastReview: types.get(c102.id)?.lastReviewType },
      createExplicit: { due: types.get(c103.id)?.dueType, lastReview: types.get(c103.id)?.lastReviewType },
      updateMany: { due: types.get(c101.id)?.dueType, lastReview: types.get(c101.id)?.lastReviewType },
    });

    // 读回一致性：无论存储类型，Prisma 都应返回合法 Date
    const readBack = await prisma.card.findMany({ where: { id: { in: [c101.id, c102.id, c103.id] } } });
    for (const c of readBack) {
      expect(c.due).toBeInstanceOf(Date);
      expect(Number.isNaN(c.due.getTime())).toBe(false);
    }
  });

  it("到期查询能选中更新后的卡（不受存储类型影响）", async () => {
    const card = await prisma.card.create({
      data: {
        userId: 1, verseId: 101,
        due: new Date(FIXED_NOW.getTime() - DAY_MS),
        stability: 2, difficulty: 5,
      },
    });

    // 更新为明天到期
    await updateCard(card.id, 1, {
      due: new Date(FIXED_NOW.getTime() + 1 * DAY_MS),
      lastReview: FIXED_NOW,
      stability: 5, difficulty: 4, reps: 1, lapses: 0, state: "learning",
    });

    // FIXED_NOW 查：不应选中（due 已更新到明天）
    const notDue = await prisma.card.findMany({ where: { userId: 1, due: { lte: FIXED_NOW } } });
    expect(notDue.map((c) => c.id)).not.toContain(card.id);

    // +2 天查：应选中
    const dueLater = await prisma.card.findMany({
      where: { userId: 1, due: { lte: new Date(FIXED_NOW.getTime() + 2 * DAY_MS) } },
    });
    expect(dueLater.map((c) => c.id)).toContain(card.id);
  });
});
