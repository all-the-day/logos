import * as planDb from "@/db/plan";
import * as verseDb from "@/db/verse";
import * as cardDb from "@/db/card";
import { Prisma } from "@prisma/client";

export async function getActivePlanDetails(userId: number) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return null;
  const book = await verseDb.getBookById(plan.bookId);
  const totalVerses = await verseDb.getVerseCount(plan.bookId);
  const workdays = Math.ceil(totalVerses / plan.versesPerDay);
  return { plan, book, totalVerses, workdays };
}

export async function initializePlan(
  userId: number,
  bookId: number,
  versesPerDay: number,
  reciteMode: "single" | "passage" = "single",
  passageSize = 5
) {
  return planDb.createPlan(userId, bookId, versesPerDay, reciteMode, passageSize);
}

/** 更新计划：每日节数 / 背诵模式 / 每组节数，可选换书卷（不删旧书卷卡片——卡片是永久学习资产） */
export async function updatePlan(
  userId: number,
  data: {
    bookId?: number;
    versesPerDay?: number;
    reciteMode?: "single" | "passage";
    passageSize?: number;
  }
) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return null;
  return planDb.updatePlan(plan.id, userId, data);
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** 为指定经节补建缺失卡片（幂等：已存在的卡不重复创建） */
export async function ensureCardsForVerses(userId: number, verseIds: number[]) {
  if (verseIds.length === 0) return 0;
  const existingCards = await cardDb.getExistingCardVerseIds(userId, verseIds);
  const toCreate = verseIds.filter((id) => !existingCards.has(id));
  if (toCreate.length === 0) return 0;

  try {
    await cardDb.createCards(userId, toCreate);
    return toCreate.length;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // 并发补卡（双标签页/连点）：批量写入撞唯一约束后逐节重试，已存在的视为成功
    let created = 0;
    for (const verseId of toCreate) {
      try {
        await cardDb.createCard(userId, verseId);
        created++;
      } catch (retryError) {
        if (!isUniqueViolation(retryError)) throw retryError;
      }
    }
    return created;
  }
}

/** 为书卷补建缺失卡片（幂等：已存在的卡不重复创建，避免 @@unique([userId, verseId]) 冲突） */
export async function ensureCardsForBook(userId: number, bookId: number) {
  const verses = await verseDb.getVersesByBook(bookId);
  if (verses.length === 0) return 0;
  return ensureCardsForVerses(userId, verses.map((v) => v.id));
}
