import * as planDb from "@/db/plan";
import * as verseDb from "@/db/verse";
import * as cardDb from "@/db/card";

export async function getActivePlanDetails(userId: number) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return null;
  const book = await verseDb.getBookById(plan.bookId);
  const totalVerses = await verseDb.getVerseCount(plan.bookId);
  const workdays = Math.ceil(totalVerses / plan.versesPerDay);
  return { plan, book, totalVerses, workdays };
}

export async function initializePlan(userId: number, bookId: number, versesPerDay: number) {
  return planDb.createPlan(userId, bookId, versesPerDay);
}

/** 更新计划：改每日节数，可选换书卷（不删旧书卷卡片——卡片是永久学习资产） */
export async function updatePlan(
  userId: number,
  data: { bookId?: number; versesPerDay?: number }
) {
  const plan = await planDb.getActivePlan(userId);
  if (!plan) return null;
  return planDb.updatePlan(plan.id, userId, data);
}

/** 为书卷补建缺失卡片（幂等：已存在的卡不重复创建，避免 @@unique([userId, verseId]) 冲突） */
export async function ensureCardsForBook(userId: number, bookId: number) {
  const verses = await verseDb.getVersesByBook(bookId);
  if (verses.length === 0) return 0;
  const existingCards = await cardDb.getExistingCardVerseIds(userId, verses.map((v) => v.id));
  const toCreate = verses.map((v) => v.id).filter((id) => !existingCards.has(id));
  if (toCreate.length > 0) {
    await cardDb.createCards(userId, toCreate);
  }
  return toCreate.length;
}
