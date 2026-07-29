import { NextResponse } from "next/server";
import * as planDb from "@/db/plan";
import * as cardDb from "@/db/card";
import * as noteDb from "@/db/note";
import * as checkinDb from "@/db/checkin";

export async function GET() {
  try {
    const plan = await planDb.getActivePlan();
    const cards = await cardDb.getAllCards();
    const notes = await noteDb.getAllNotes();
    const checkins = await checkinDb.getAllCheckins();

    const data = { plan, cards, notes, checkins, exportedAt: new Date().toISOString() };
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导出失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const data = JSON.parse(text);

    if (data.plan) {
      const existing = await planDb.getActivePlan();
      if (existing) await planDb.deletePlan(existing.id);
      await planDb.createPlan(data.plan.bookId, data.plan.versesPerDay);
    }

    if (data.cards && Array.isArray(data.cards)) {
      const existingCardIds = (await cardDb.getAllCards()).map((c) => c.verseId);
      for (const c of data.cards) {
        // Skip if card for this verse already exists
        if (existingCardIds.includes(c.verseId)) continue;
        try {
          await cardDb.createCard(c.verseId);
          // Restore FSRS state if available
          if (c.stability !== undefined || c.state !== undefined) {
            const cards = await cardDb.getCardsForVerse(c.verseId);
            const card = cards[cards.length - 1];
            if (card) {
              await cardDb.updateCard(card.id, {
                stability: c.stability ?? card.stability,
                difficulty: c.difficulty ?? card.difficulty,
                reps: c.reps ?? card.reps,
                lapses: c.lapses ?? card.lapses,
                state: c.state ?? card.state,
                lastReview: c.lastReview ? new Date(c.lastReview) : null,
                due: c.due ? new Date(c.due) : card.due,
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
          await noteDb.createNote(n.verseId, n.content);
        } catch { /* skip duplicates */ }
      }
    }

    if (data.checkins && Array.isArray(data.checkins)) {
      for (const c of data.checkins) {
        if (!c.date) continue;
        try {
          await checkinDb.createCheckin(c.date, c.verseText);
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
  try {
    await cardDb.deleteAllCards();
    await noteDb.deleteAllNotes();
    await checkinDb.deleteAllCheckins();
    await planDb.deleteAllPlans();
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "清除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
