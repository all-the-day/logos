import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { rateCard } from "@/services/card";
import { clearDb, FIXED_NOW } from "@/tests/fixtures/seed-test";

async function seed() {
  await clearDb();
  await prisma.user.create({ data: { id: 1, username: "alice", name: "爱丽丝", passwordHash: "x" } });
  await prisma.book.create({ data: { id: 1, name: "测试卷一", chapters: 1 } });
  await prisma.verse.create({ data: { id: 101, bookId: 1, chapter: 1, verse: 1, content: "经101", kjv: null } });
  await prisma.card.create({ data: { userId: 1, verseId: 101 } }); // state 默认 new
}

describe("rateCard 首次评分写入 introducedAt（#6 数据依据）", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
    await seed();
  });
  afterAll(() => vi.useRealTimers());

  it("新卡首次评分后 introducedAt 非空", async () => {
    const card = await prisma.card.findFirstOrThrow({ where: { userId: 1 } });
    await rateCard(1, card.id, 3);
    const saved = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
    expect(saved.state).toBe("learning");
    expect(saved.introducedAt).not.toBeNull();
  });
});
