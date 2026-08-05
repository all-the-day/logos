import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const [verseCount, cardCount, noteCount, checkinCount] = await Promise.all([
      prisma.verse.count(),
      prisma.card.count({ where: { userId: user.id } }),
      prisma.note.count({ where: { userId: user.id } }),
      prisma.checkin.count({ where: { userId: user.id } }),
    ]);
    return NextResponse.json({ verses: verseCount, cards: cardCount, notes: noteCount, checkins: checkinCount });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取统计失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
