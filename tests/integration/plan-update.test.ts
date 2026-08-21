import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clearDb } from "@/tests/fixtures/seed-test";
import { updatePlan, ensureCardsForBook, initializePlan } from "@/services/plan";

async function seed() {
  await clearDb();
  await prisma.user.create({ data: { id: 1, username: "alice", name: "爱丽丝", passwordHash: "x" } });
  await prisma.book.create({ data: { id: 1, name: "测试卷一", chapters: 1 } });
  await prisma.book.create({ data: { id: 2, name: "测试卷二", chapters: 1 } });
  await prisma.verse.createMany({
    data: [
      { id: 101, bookId: 1, chapter: 1, verse: 1, content: "经101", kjv: null },
      { id: 102, bookId: 1, chapter: 1, verse: 2, content: "经102", kjv: null },
      { id: 201, bookId: 2, chapter: 1, verse: 1, content: "经201", kjv: null },
    ],
  });
}

describe("updatePlan / ensureCardsForBook（修改计划）", () => {
  beforeEach(seed);

  it("修改每日节数不换书卷", async () => {
    await initializePlan(1, 1, 3);
    const updated = await updatePlan(1, { versesPerDay: 5 });
    expect(updated?.versesPerDay).toBe(5);
    expect(updated?.bookId).toBe(1);
  });

  it("换书卷时保留旧书卷卡片，并为新书卷补建缺失卡", async () => {
    await initializePlan(1, 1, 3);
    await ensureCardsForBook(1, 1); // 书卷 1 建 2 张卡
    await prisma.card.updateMany({
      where: { userId: 1, verseId: 101 },
      data: { state: "learning" },
    }); // 模拟一张已学的卡（换书卷后必须保留）

    const updated = await updatePlan(1, { bookId: 2, versesPerDay: 3 });
    expect(updated?.bookId).toBe(2);

    const created = await ensureCardsForBook(1, 2);
    expect(created).toBe(1); // 书卷 2 的 201 补建

    const cards = await prisma.card.findMany({ where: { userId: 1 } });
    const verseIds = cards.map((c) => c.verseId).sort();
    expect(verseIds).toEqual([101, 102, 201]); // 旧卡 101 保留，102 已建，201 新补
    expect(
      (await prisma.card.findFirst({ where: { userId: 1, verseId: 101 } }))?.state
    ).toBe("learning"); // 学习状态未丢失
  });

  it("ensureCardsForBook 幂等：重复调用不重复建卡", async () => {
    await initializePlan(1, 1, 3);
    await ensureCardsForBook(1, 1);
    const again = await ensureCardsForBook(1, 1);
    expect(again).toBe(0);
    expect(await prisma.card.count({ where: { userId: 1 } })).toBe(2);
  });

  it("无活动计划时 updatePlan 返回 null", async () => {
    expect(await updatePlan(1, { versesPerDay: 3 })).toBeNull();
  });
});
