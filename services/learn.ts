import * as planDb from "@/db/plan";
import * as verseDb from "@/db/verse";
import * as cardDb from "@/db/card";
import { getTodayString } from "@/lib/date";

export async function getTodayTasks() {
  const plan = await planDb.getActivePlan();
  if (!plan) return { plan: null, tasks: [] };

  const today = getTodayString();
  const startDate = new Date(plan.startDate).toISOString().split("T")[0];
  const daysDiff = Math.floor(
    (new Date(today).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysDiff < 0) return { plan, tasks: [] };

  // Calculate verse range for today (skip Sundays)
  let workdaysPassed = 0;
  let currentDate = new Date(startDate);
  for (let i = 0; i <= daysDiff; i++) {
    if (currentDate.getDay() !== 0) workdaysPassed++;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const startIdx = (workdaysPassed - 1) * plan.versesPerDay;
  const endIdx = startIdx + plan.versesPerDay;

  const verses = await verseDb.getVersesByBook(plan.bookId);
  const todayVerses = verses.slice(startIdx, endIdx);

  return { plan, tasks: todayVerses };
}
