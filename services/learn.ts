import * as planDb from "@/db/plan";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { TaskData } from "@/types";

const MAX_REVIEW_PER_DAY = 50;

/**
 * 复习队列查询条件 —— 任务与摘要共享，防止两处条件漂移。
 * 约束：当前书卷、非新卡、已到期（due <= now）。
 */
function reviewWhere(userId: number, bookId: number, now: Date): Prisma.CardWhereInput {
  return {
    userId,
    state: { not: "new" },
    due: { lte: now },
    verse: { bookId },
  };
}

/**
 * 新卡队列查询条件 —— 任务与摘要共享。
 * 约束：当前书卷、未学习。
 */
function newWhere(userId: number, bookId: number): Prisma.CardWhereInput {
  return {
    userId,
    state: "new",
    verse: { bookId },
  };
}

export async function getTodayTasks(userId: number, now: Date = new Date()) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return { plan: null, tasks: [] as TaskData[] };

  // 1) 复习队列：当前书卷的已到期且非新卡
  const reviewCards = await prisma.card.findMany({
    where: reviewWhere(userId, plan.bookId, now),
    include: { verse: true },
    orderBy: [{ due: "asc" }, { stability: "asc" }],
    take: MAX_REVIEW_PER_DAY,
  });

  // 2) 新卡队列：当前书卷的未学卡片，按章节/节顺序取 versesPerDay 个
  const newCards = await prisma.card.findMany({
    where: newWhere(userId, plan.bookId),
    include: { verse: true },
    orderBy: [{ verse: { chapter: "asc" } }, { verse: { verse: "asc" } }],
    take: plan.versesPerDay,
  });

  // 3) 合并：复习在前，新卡在后
  const allCards = [...reviewCards, ...newCards];

  // 4) 转为 verse 视图（保留 card 字段供前端使用）
  const tasks: TaskData[] = allCards.map((c) => ({
    id: c.verseId, // 兼容旧 API：task.id = verseId
    bookId: c.verse.bookId,
    chapter: c.verse.chapter,
    verse: c.verse.verse,
    content: c.verse.content,
    kjv: c.verse.kjv,
    cardId: c.id,
    cardState: c.state,
    cardStability: c.stability,
    cardDifficulty: c.difficulty,
    cardReps: c.reps,
    cardLapses: c.lapses,
    cardLastReview: c.lastReview,
    cardDue: c.due,
  }));

  return { plan, tasks };
}

/**
 * 今日任务摘要 — 与 getTodayTasks 共享查询条件（reviewWhere/newWhere），
 * 保证摘要数字与 /learn 队列实际数量相符。
 * now 默认在每次调用时生成一次；测试可传入固定时间点。
 */
export async function getTodaySummary(userId: number, now: Date = new Date()) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return { review: 0, new: 0 };

  const review = await prisma.card.count({
    where: reviewWhere(userId, plan.bookId, now),
  });

  const newCount = await prisma.card.count({
    where: newWhere(userId, plan.bookId),
  });

  return {
    review: Math.min(review, MAX_REVIEW_PER_DAY),
    new: Math.min(newCount, plan.versesPerDay),
  };
}
