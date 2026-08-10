import { NextResponse } from "next/server";
import * as planDb from "@/db/plan";
import * as cardDb from "@/db/card";
import * as noteDb from "@/db/note";
import * as checkinDb from "@/db/checkin";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/date";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const plan = await planDb.getActivePlan(user.id);
    const cards = await cardDb.getAllCards(user.id);
    const notes = await noteDb.getAllNotes(user.id);
    const checkins = await checkinDb.getAllCheckins(user.id);

    const data = { plan, cards, notes, checkins, exportedAt: new Date().toISOString() };
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导出失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const data = JSON.parse(text);

    if (data.plan) {
      const existing = await planDb.getActivePlan(user.id);
      if (existing) await planDb.deletePlan(existing.id, user.id);
      await planDb.createPlan(user.id, data.plan.bookId, data.plan.versesPerDay);
    }

    if (data.cards && Array.isArray(data.cards)) {
      const existingCardIds = (await cardDb.getAllCards(user.id)).map((c) => c.verseId);
      for (const c of data.cards) {
        // Skip if card for this verse already exists
        if (existingCardIds.includes(c.verseId)) continue;
        try {
          await cardDb.createCard(user.id, c.verseId);
          // Restore FSRS state if available
          if (c.stability !== undefined || c.state !== undefined) {
            const cards = await cardDb.getCardsForVerse(c.verseId, user.id);
            const card = cards[cards.length - 1];
            if (card) {
              // 边界校验：非法日期直接跳过该卡，不产生半成品
              const parsedLastReview = parseDateInput(c.lastReview);
              const parsedDue = parseDateInput(c.due);
              if (
                (c.lastReview != null && !parsedLastReview) ||
                (c.due != null && !parsedDue)
              ) {
                continue;
              }
              await cardDb.updateCard(card.id, user.id, {
                stability: c.stability ?? card.stability,
                difficulty: c.difficulty ?? card.difficulty,
                reps: c.reps ?? card.reps,
                lapses: c.lapses ?? card.lapses,
                state: c.state ?? card.state,
                lastReview: parsedLastReview,
                due: parsedDue ?? card.due,
              });
            }
          }
        } catch { /* skip import errors */ }
      }
    }

    if (data.notes && Array.isArray(data.notes)) {
      for (const n of data.notes) {
        if (!n.verseId || !n.content) continue;
        try {
          await noteDb.createNote(user.id, n.verseId, n.content);
        } catch { /* skip duplicates */ }
      }
    }

    if (data.checkins && Array.isArray(data.checkins)) {
      for (const c of data.checkins) {
        if (!c.date) continue;
        try {
          await checkinDb.createCheckin(user.id, c.date, c.verseText);
        } catch { /* skip duplicates */ }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导入失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    await cardDb.deleteAllCards(user.id);
    await noteDb.deleteAllNotes(user.id);
    await checkinDb.deleteAllCheckins(user.id);
    await planDb.deleteAllPlans(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "清除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
