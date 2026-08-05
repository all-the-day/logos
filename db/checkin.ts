import { prisma } from "@/lib/prisma";
import { getDateString } from "@/lib/date";

export async function getCheckinByDate(date: string, userId: number) {
  return prisma.checkin.findUnique({ where: { userId_date: { userId, date } } });
}

export async function getAllCheckins(userId: number) {
  return prisma.checkin.findMany({ where: { userId }, orderBy: { date: "desc" } });
}

export async function createCheckin(userId: number, date: string, verseText?: string) {
  return prisma.checkin.create({ data: { userId, date, verseText } });
}

export async function getCheckinStreak(userId: number): Promise<number> {
  const checkins = await prisma.checkin.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });
  if (checkins.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getDateString(d); // 本地时间，避免 UTC 错位
    if (checkins.some((c) => c.date === dateStr)) {
      streak++;
    } else if (i === 0) {
      continue; // today not yet checked in
    } else {
      break;
    }
  }
  return streak;
}

export async function deleteAllCheckins(userId: number) {
  return prisma.checkin.deleteMany({ where: { userId } });
}
