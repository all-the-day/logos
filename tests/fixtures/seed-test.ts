/**
 * 学习队列集成测试夹具。
 *
 * 数据约定（测试库 prisma/test.db，非 dev.db）：
 * - alice(1)：活跃计划 → book1(versesPerDay=2)；已删除计划 → book2
 * - bob(2)：无计划
 *
 * alice @ book1 的卡片：
 *   复习队列（due <= now 且非 new）：v202(-3d) v201(-2d) v101(-1d) v102(=now)  → 4 张，按 due asc
 *   未来到期（排除）：v103(+1d, relearning)
 *   新卡（take versesPerDay=2）：v301 v302（按章/节序）→ 2 张；v303 v304 超出取数
 * alice @ book2（已删除计划）：v401(review -1d) v402(new) → 必须排除
 * bob（其他用户）：v102(review -1d) v301(new) → 必须排除
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const ALICE_ID = 1;
export const BOB_ID = 2;
export const FIXED_NOW = new Date("2026-08-07T04:00:00.000Z"); // 12:00 (+08:00)

const DAY_MS = 86400000;
const day = (n: number) => new Date(FIXED_NOW.getTime() + n * DAY_MS);

export async function clearDb() {
  await prisma.card.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.note.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.annotation.deleteMany();
  await prisma.verse.deleteMany();
  await prisma.book.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

function cardData(rows: Array<{ userId: number; verseId: number; state: string; due: Date }>): Prisma.CardCreateManyInput[] {
  return rows.map((r) => ({
    userId: r.userId,
    verseId: r.verseId,
    state: r.state,
    due: r.due,
    stability: 2.0,
    difficulty: 5.0,
    reps: r.state === "new" ? 0 : 3,
    lapses: r.state === "relearning" ? 1 : 0,
    lastReview: null,
  }));
}

/** 基础夹具：清空并重建最小数据集 */
export async function seedBase() {
  await clearDb();

  await prisma.user.create({ data: { id: ALICE_ID, username: "alice", name: "爱丽丝", passwordHash: "x" } });
  await prisma.user.create({ data: { id: BOB_ID, username: "bob", name: "鲍勃", passwordHash: "x" } });

  await prisma.book.create({ data: { id: 1, name: "测试卷一", chapters: 3 } });
  await prisma.book.create({ data: { id: 2, name: "测试卷二", chapters: 1 } });

  // 经节（id 约定：章*100+节；book1: 1xx/2xx/3xx，book2: 4xx）
  const verses: Array<{ id: number; bookId: number; chapter: number; verse: number }> = [
    { id: 101, bookId: 1, chapter: 1, verse: 1 },
    { id: 102, bookId: 1, chapter: 1, verse: 2 },
    { id: 103, bookId: 1, chapter: 1, verse: 3 },
    { id: 201, bookId: 1, chapter: 2, verse: 1 },
    { id: 202, bookId: 1, chapter: 2, verse: 2 },
    { id: 301, bookId: 1, chapter: 3, verse: 1 },
    { id: 302, bookId: 1, chapter: 3, verse: 2 },
    { id: 303, bookId: 1, chapter: 3, verse: 3 },
    { id: 304, bookId: 1, chapter: 3, verse: 4 },
    { id: 401, bookId: 2, chapter: 1, verse: 1 },
    { id: 402, bookId: 2, chapter: 1, verse: 2 },
  ];
  await prisma.verse.createMany({
    data: verses.map((v) => ({ ...v, content: `测试经文${v.id}`, kjv: null })),
  });

  await prisma.plan.create({ data: { id: 1, userId: ALICE_ID, bookId: 1, versesPerDay: 2, status: "active" } });
  await prisma.plan.create({ data: { id: 2, userId: ALICE_ID, bookId: 2, versesPerDay: 3, status: "deleted" } });

  await prisma.card.createMany({
    data: cardData([
      // alice @ book1：复习队列
      { userId: ALICE_ID, verseId: 202, state: "review", due: day(-3) },
      { userId: ALICE_ID, verseId: 201, state: "review", due: day(-2) },
      { userId: ALICE_ID, verseId: 101, state: "review", due: day(-1) },
      { userId: ALICE_ID, verseId: 102, state: "learning", due: day(0) },
      // 未来到期，排除
      { userId: ALICE_ID, verseId: 103, state: "relearning", due: day(1) },
      // 新卡
      { userId: ALICE_ID, verseId: 301, state: "new", due: day(30) },
      { userId: ALICE_ID, verseId: 302, state: "new", due: day(30) },
      { userId: ALICE_ID, verseId: 303, state: "new", due: day(30) },
      { userId: ALICE_ID, verseId: 304, state: "new", due: day(30) },
      // 已删除计划的书（book2）
      { userId: ALICE_ID, verseId: 401, state: "review", due: day(-1) },
      { userId: ALICE_ID, verseId: 402, state: "new", due: day(30) },
      // 其他用户
      { userId: BOB_ID, verseId: 102, state: "review", due: day(-1) },
      { userId: BOB_ID, verseId: 301, state: "new", due: day(30) },
    ]),
  });
}

/**
 * 上限测试夹具：在基础夹具上追加 extraCount 张 book1 的到期复习卡。
 * 配合基础夹具 4 张，总到期复习数 = 4 + extraCount。
 */
export async function seedWithManyDueReviews(extraCount: number) {
  await seedBase();

  const startId = 5000;
  const verses: Array<{ id: number; bookId: number; chapter: number; verse: number }> = [];
  const cards: Prisma.CardCreateManyInput[] = [];
  for (let i = 0; i < extraCount; i++) {
    const id = startId + i;
    verses.push({ id, bookId: 1, chapter: 5, verse: i + 1 });
    cards.push({
      userId: ALICE_ID,
      verseId: id,
      state: "review",
      due: day(-100),
      stability: 2.0,
      difficulty: 5.0,
      reps: 3,
      lapses: 0,
      lastReview: null,
    });
  }
  await prisma.verse.createMany({
    data: verses.map((v) => ({ ...v, content: `测试经文${v.id}`, kjv: null })),
  });
  await prisma.card.createMany({ data: cards });
}
