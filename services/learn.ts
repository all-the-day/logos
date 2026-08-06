import * as planDb from "@/db/plan";
import { prisma } from "@/lib/prisma";
import type { TaskData } from "@/types";

const MAX_REVIEW_PER_DAY = 50;

export async function getTodayTasks(userId: number) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return { plan: null, tasks: [] as TaskData[] };

  const now = new Date();

  // 1) 复习队列：当前书卷的已到期且非新卡
  const reviewCards = await prisma.card.findMany({
    where: {
      userId,
      state: { not: "new" },
      due: { lte: now },
      verse: { bookId: plan.bookId },
    },
    include: { verse: true },
    orderBy: [{ due: "asc" }, { stability: "asc" }],
    take: MAX_REVIEW_PER_DAY,
  });

  // 2) 新卡队列：当前书卷的未学卡片，按章节/节顺序取 versesPerDay 个
  const newCards = await prisma.card.findMany({
    where: {
      userId,
      state: "new",
      verse: { bookId: plan.bookId },
    },
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
