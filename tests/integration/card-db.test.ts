import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getDueCards } from "@/db/card";
import { prisma } from "@/lib/prisma";
import { clearDb, FIXED_NOW } from "@/tests/fixtures/seed-test";

const DAY_MS = 86400000;

async function seedDueFixture() {
  await clearDb();
  await prisma.user.create({ data: { id: 1, username: "alice", name: "爱丽丝", passwordHash: "x" } });
  await prisma.book.create({ data: { id: 1, name: "测试卷一", chapters: 1 } });
  await prisma.verse.createMany({
    data: [
      { id: 101, bookId: 1, chapter: 1, verse: 1, content: "经101", kjv: null },
      { id: 102, bookId: 1, chapter: 1, verse: 2, content: "经102", kjv: null },
    ],
  });
  // 到期复习卡
  await prisma.card.create({
    data: {
      userId: 1, verseId: 101, state: "review",
      due: new Date(FIXED_NOW.getTime() - DAY_MS),
      stability: 5, difficulty: 5, reps: 3, lapses: 0,
    },
  });
  // 到期但从未学过的新卡：绝不应进入复习到期队列
  await prisma.card.create({
    data: {
      userId: 1, verseId: 102, state: "new",
      due: new Date(FIXED_NOW.getTime() - DAY_MS),
      stability: 2, difficulty: 5, reps: 0, lapses: 0,
    },
  });
}

describe("getDueCards 语义（复习到期，不含新卡）", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
    await seedDueFixture();
  });
  afterAll(() => vi.useRealTimers());

  it("到期的新卡不得泄漏进复习队列", async () => {
    const cards = await getDueCards(1);
    const verseIds = cards.map((c) => c.verseId);
    expect(verseIds).toContain(101); // 到期复习卡应被选中
    expect(verseIds).not.toContain(102); // 到期新卡应被排除
    for (const c of cards) expect(c.state).not.toBe("new");
  });
});
