import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [verseCount, cardCount, noteCount, checkinCount] = await Promise.all([
      prisma.verse.count(),
      prisma.card.count(),
      prisma.note.count(),
      prisma.checkin.count(),
    ]);
    return NextResponse.json({ verses: verseCount, cards: cardCount, notes: noteCount, checkins: checkinCount });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取统计失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
