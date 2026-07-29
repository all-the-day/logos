import * as checkinDb from "@/db/checkin";
import { getTodayString } from "@/lib/date";

export async function getCheckinStatus() {
  const today = getTodayString();
  const checkin = await checkinDb.getCheckinByDate(today);
  const streak = await checkinDb.getCheckinStreak();
  return { checkedIn: !!checkin, streak };
}

export async function doCheckin() {
  const today = getTodayString();
  return checkinDb.createCheckin(today);
}
