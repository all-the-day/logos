import * as checkinDb from "@/db/checkin";
import { getTodayString } from "@/lib/date";

export async function getCheckinStatus(userId: number) {
  const today = getTodayString();
  const checkin = await checkinDb.getCheckinByDate(today, userId);
  const streak = await checkinDb.getCheckinStreak(userId);
  return { checkedIn: !!checkin, streak };
}

export async function doCheckin(userId: number) {
  const today = getTodayString();
  // 幂等：今天已签到则直接返回，避免唯一约束冲突
  const existing = await checkinDb.getCheckinByDate(today, userId);
  if (existing) return existing;
  return checkinDb.createCheckin(userId, today);
}
