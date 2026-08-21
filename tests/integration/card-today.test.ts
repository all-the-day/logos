import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getTodayNewCount } from "@/db/card";
import { prisma } from "@/lib/prisma";
import { clearDb, FIXED_NOW } from "@/tests/fixtures/seed-test";

const DAY_MS = 86400000;
const base = FIXED_NOW.getTime();

async function seed() {
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
  // 今天首次引入的新卡（introducedAt 在今天零点后）
  await prisma.card.create({
    data: { userId: 1, verseId: 101, state: "review", introducedAt: new Date(base), stability: 5, difficulty: 5, reps: 2, lapses: 0 },
  });
  await prisma.card.create({
    data: { userId: 1, verseId: 102, state: "learning", introducedAt: new Date(base), stability: 2, difficulty: 5, reps: 1, lapses: 0 },
  });
  // 昨天引入的（不应计入今天）
  await prisma.card.create({
    data: { userId: 1, verseId: 103, state: "review", introducedAt: new Date(base - DAY_MS), stability: 8, difficulty: 5, reps: 4, lapses: 0 },
  });
}

describe("getTodayNewCount（今日新卡进度分母）", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
    await seed();
  });
  afterAll(() => vi.useRealTimers());

  it("只统计今天首次引入的卡，排除昨日与从未引入的", async () => {
    expect(await getTodayNewCount(1)).toBe(2);
  });

  it("其他用户的数据不影响", async () => {
    await prisma.user.create({ data: { id: 2, username: "bob", name: "鲍勃", passwordHash: "x" } });
    await prisma.verse.create({ data: { id: 104, bookId: 1, chapter: 1, verse: 4, content: "经104", kjv: null } });
    await prisma.card.create({
      data: { userId: 2, verseId: 104, state: "review", introducedAt: new Date(base), stability: 5, difficulty: 5, reps: 2, lapses: 0 },
    });
    expect(await getTodayNewCount(1)).toBe(2);
    expect(await getTodayNewCount(2)).toBe(1);
  });
});
