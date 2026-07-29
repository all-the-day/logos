import * as planDb from "@/db/plan";
import * as verseDb from "@/db/verse";

export async function getActivePlanDetails() {
  const plan = await planDb.getActivePlan();
  if (!plan) return null;
  const book = await verseDb.getBookById(plan.bookId);
  const totalVerses = await verseDb.getVerseCount(plan.bookId);
  const workdays = Math.ceil(totalVerses / plan.versesPerDay);
  return { plan, book, totalVerses, workdays };
}

export async function initializePlan(bookId: number, versesPerDay: number) {
  return planDb.createPlan(bookId, versesPerDay);
}
