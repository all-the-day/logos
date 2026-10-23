import * as planDb from "@/db/plan";
import { prisma } from "@/lib/prisma";
import { startOfLocalDay } from "@/lib/date";
import type { Prisma } from "@prisma/client";
import type { TaskData } from "@/types";

const MAX_REVIEW_PER_DAY = 50;

/**
 * 复习队列查询条件 —— 任务与摘要共享，防止两处条件漂移。
 * 约束：跨全部已学书卷、非新卡、已到期（due <= now）。
 * 卡片是用户的永久学习资产；换计划/删除计划不删卡，旧书卷到期卡继续进入复习。
 */
function reviewWhere(userId: number, now: Date): Prisma.CardWhereInput {
  return {
    userId,
    state: { not: "new" },
    due: { lte: now },
  };
}

/**
 * 新卡队列查询条件 —— 任务与摘要共享。
 * 约束：当前计划书卷、未学习。
 */
function newWhere(userId: number, bookId: number): Prisma.CardWhereInput {
  return {
    userId,
    state: "new",
    verse: { bookId },
  };
}

/**
 * 今日剩余新卡配额 = versesPerDay - 今日首次引入数（introducedAt >= 本地零点）。
 * introducedAt 在卡片首次离开 new 态时写入，重学不会重复计数。
 */
async function getRemainingNewQuota(
  userId: number,
  bookId: number,
  versesPerDay: number,
  now: Date
): Promise<number> {
  const startOfDay = startOfLocalDay(now);
  const introducedToday = await prisma.card.count({
    where: {
      userId,
      verse: { bookId },
      introducedAt: { gte: startOfDay },
    },
  });
  return Math.max(0, versesPerDay - introducedToday);
}

export function toTask(card: {
  id: number;
  verseId: number;
  state: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
  due: Date;
  verse: {
    id: number;
    bookId: number;
    chapter: number;
    verse: number;
    content: string;
    kjv: string | null;
    book: { name: string };
  };
}): TaskData {
  return {
    id: card.verseId, // 兼容旧 API：task.id = verseId
    bookName: card.verse.book.name,
    bookId: card.verse.bookId,
    chapter: card.verse.chapter,
    verse: card.verse.verse,
    content: card.verse.content,
    kjv: card.verse.kjv,
    cardId: card.id,
    cardState: card.state,
    cardStability: card.stability,
    cardDifficulty: card.difficulty,
    cardReps: card.reps,
    cardLapses: card.lapses,
    cardLastReview: card.lastReview,
    cardDue: card.due,
  };
}

/**
 * 把同章且节号连续的任务按 size 分组；节号断开处断组，剩余不足 size 的也成一组。
 * 不按卡片状态分组：自由练习的范围可能混合新卡与已学经节，按状态断组会让
 * 用户设置的"每组 N 节"缩水；混合组由 toPassageTask 打 hasNew 标记，
 * 在客户端整组先查看再背诵。
 */
function chunkPassages(tasks: TaskData[], size: number): TaskData[][] {
  const sorted = [...tasks].sort(
    (a, b) => a.bookId - b.bookId || a.chapter - b.chapter || a.verse - b.verse
  );
  const groups: TaskData[][] = [];
  let current: TaskData[] = [];
  let prev: TaskData | null = null;

  const flush = () => {
    if (current.length > 0) groups.push(current);
    current = [];
  };

  for (const task of sorted) {
    const contiguous =
      prev !== null &&
      prev.bookId === task.bookId &&
      prev.chapter === task.chapter &&
      prev.verse + 1 === task.verse;
    if (current.length >= size || (current.length > 0 && !contiguous)) {
      flush();
    }
    current.push(task);
    prev = task;
  }
  flush();

  return groups;
}

/** 把一组单节任务合并成一个连背任务：content 为拼接原文，cardIds 为组内卡片 */
function toPassageTask(group: TaskData[]): TaskData {
  const verses = [...group].sort((a, b) => a.verse - b.verse);
  const firstVerse = verses[0];
  const lastVerse = verses[verses.length - 1];

  return {
    ...firstVerse,
    verse: firstVerse.verse,
    verseEnd: lastVerse.verse,
    content: verses.map((v) => v.content).join(""),
    kjv: null,
    isPassage: true,
    cardIds: verses.map((v) => v.cardId),
    // 结果页按节分行展示差异用（组内按节号升序）
    passageVerses: verses.map((v) => ({ verse: v.verse, content: v.content })),
    // 撤销用：组内每张卡的独立 FSRS 快照（不能都拿第一节的覆盖整组）
    passageCards: verses.map((v) => ({
      cardId: v.cardId,
      stability: v.cardStability,
      difficulty: v.cardDifficulty,
      reps: v.cardReps,
      lapses: v.cardLapses,
      state: v.cardState,
      lastReview: v.cardLastReview,
      due: v.cardDue,
    })),
    cardId: firstVerse.cardId,
    cardState: verses.every((v) => v.cardState === "new") ? "new" : "review",
    // 组内是否含未学经节：混合组需要整组先查看再背诵（不泄露原文）
    hasNew: verses.some((v) => v.cardState === "new"),
  };
}

/**
 * 按背诵模式组装队列：passage 时同章连续经节合成一组，落单回退为单节任务。
 * 学习页（今日队列）与自由练习共用，避免分组规则漂移。
 */
export function groupTasksByReciteMode(
  tasks: TaskData[],
  mode: string,
  passageSize: number
): TaskData[] {
  if (mode !== "passage") return tasks;
  const size = Math.max(2, passageSize || 5);
  return chunkPassages(tasks, size).map((group) =>
    group.length >= 2 ? toPassageTask(group) : group[0]
  );
}

async function fetchReviewTasks(userId: number, now: Date): Promise<TaskData[]> {
  const reviewCards = await prisma.card.findMany({
    where: reviewWhere(userId, now),
    include: { verse: { include: { book: true } } },
    orderBy: [
      { due: "asc" },
      { stability: "asc" },
      { verse: { bookId: "asc" } },
      { verse: { chapter: "asc" } },
      { verse: { verse: "asc" } },
    ],
    take: MAX_REVIEW_PER_DAY,
  });
  return reviewCards.map(toTask);
}

async function fetchNewTasks(
  userId: number,
  bookId: number,
  versesPerDay: number,
  now: Date
): Promise<TaskData[]> {
  const newLimit = await getRemainingNewQuota(userId, bookId, versesPerDay, now);
  if (newLimit <= 0) return [];

  const newCards = await prisma.card.findMany({
    where: newWhere(userId, bookId),
    include: { verse: { include: { book: true } } },
    orderBy: [{ verse: { chapter: "asc" } }, { verse: { verse: "asc" } }],
    take: newLimit,
  });
  return newCards.map(toTask);
}

export async function getTodayTasks(userId: number, now: Date = new Date()) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return { plan: null, tasks: [] as TaskData[] };

  // 1) 复习队列：跨书卷的已到期且非新卡
  const reviewTasks = await fetchReviewTasks(userId, now);
  // 2) 新卡队列：当前书卷的未学卡片，按章节/节顺序取今日剩余配额
  const newTasks = await fetchNewTasks(userId, plan.bookId, plan.versesPerDay, now);

  if (plan.reciteMode === "passage") {
    const size = Math.max(2, plan.passageSize || 5);
    // 复习组在前、新卡组在后；各自按“同章连续”分组，不把复习和新卡混在一组。
    // 节号不连续被断开；落单（组内只有 1 节）的回退为普通单节任务，保留 KJV 对照。
    const passages = [
      ...groupTasksByReciteMode(reviewTasks, "passage", size),
      ...groupTasksByReciteMode(newTasks, "passage", size),
    ];
    return { plan, tasks: passages };
  }

  // 3) 合并：复习在前，新卡在后
  return { plan, tasks: [...reviewTasks, ...newTasks] };
}

/**
 * 今日任务摘要 — 与 getTodayTasks 共享查询条件（reviewWhere/newWhere 与配额），
 * 保证摘要数字与 /learn 队列实际数量相符。
 * now 默认在每次调用时生成一次；测试可传入固定时间点。
 */
export async function getTodaySummary(userId: number, now: Date = new Date()) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return { review: 0, new: 0 };

  const review = await prisma.card.count({
    where: reviewWhere(userId, now),
  });

  const newCount = await prisma.card.count({
    where: newWhere(userId, plan.bookId),
  });

  const newLimit = await getRemainingNewQuota(userId, plan.bookId, plan.versesPerDay, now);

  return {
    review: Math.min(review, MAX_REVIEW_PER_DAY),
    new: Math.min(newCount, newLimit),
  };
}
