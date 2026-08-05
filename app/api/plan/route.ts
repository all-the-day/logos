import { NextResponse } from "next/server";
import * as planService from "@/services/plan";
import * as planDb from "@/db/plan";
import * as cardDb from "@/db/card";
import * as verseDb from "@/db/verse";

export async function GET() {
  try {
    const planDetails = await planService.getActivePlanDetails();
    if (!planDetails) {
      return NextResponse.json({ plan: null });
    }
    const progress = await cardDb.getCardProgress(planDetails.plan.bookId);
    return NextResponse.json({ ...planDetails, progress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { bookId, versesPerDay } = JSON.parse(text);
    if (!bookId || !versesPerDay) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    // Deactivate existing plan and clean up its cards
    const existing = await planDb.getActivePlan();
    if (existing) {
      const oldBookId = existing.bookId;
      await planDb.deletePlan(existing.id);
      // 删除旧书卷的卡片，避免重复累积
      await cardDb.deleteCardsByBook(oldBookId);
    }

    const plan = await planService.initializePlan(bookId, versesPerDay);

    // Initialize cards for all verses in the book (batch)
    const verses = await verseDb.getVersesByBook(bookId);
    await cardDb.createCards(verses.map((v) => v.id));

    return NextResponse.json({ plan });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const plan = await planDb.getActivePlan();
    if (plan) {
      // Clean up cards for this book
      await cardDb.deleteCardsByBook(plan.bookId);
      // Soft-delete plan
      await planDb.deletePlan(plan.id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "删除计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
