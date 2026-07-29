import { prisma } from "@/lib/prisma";

export async function getCheckinByDate(date: string) {
  return prisma.checkin.findUnique({ where: { date } });
}

export async function getAllCheckins() {
  return prisma.checkin.findMany({ orderBy: { date: "desc" } });
}

export async function createCheckin(date: string, verseText?: string) {
  return prisma.checkin.create({ data: { date, verseText } });
}

export async function getCheckinStreak(): Promise<number> {
  const checkins = await prisma.checkin.findMany({
    orderBy: { date: "desc" },
  });
  if (checkins.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
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

export async function deleteAllCheckins() {
  return prisma.checkin.deleteMany();
}
