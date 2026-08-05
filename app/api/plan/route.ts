import { NextResponse } from "next/server";
import * as planService from "@/services/plan";
import * as planDb from "@/db/plan";
import * as cardDb from "@/db/card";
import * as verseDb from "@/db/verse";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const planDetails = await planService.getActivePlanDetails(user.id);
    if (!planDetails) {
      return NextResponse.json({ plan: null });
    }
    const progress = await cardDb.getCardProgress(planDetails.plan.bookId, user.id);
    return NextResponse.json({ ...planDetails, progress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { bookId, versesPerDay } = JSON.parse(text);
    if (!bookId || !versesPerDay) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    // Deactivate existing plan and clean up its cards
    const existing = await planDb.getActivePlan(user.id);
    if (existing) {
      const oldBookId = existing.bookId;
      await planDb.deletePlan(existing.id, user.id);
      // 删除旧书卷的卡片，避免重复累积
      await cardDb.deleteCardsByBook(oldBookId, user.id);
    }

    const plan = await planService.initializePlan(user.id, bookId, versesPerDay);

    // Initialize cards for all verses in the book (batch)
    const verses = await verseDb.getVersesByBook(bookId);
    await cardDb.createCards(user.id, verses.map((v) => v.id));

    return NextResponse.json({ plan });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const plan = await planDb.getActivePlan(user.id);
    if (plan) {
      // Clean up cards for this book
      await cardDb.deleteCardsByBook(plan.bookId, user.id);
      // Soft-delete plan
      await planDb.deletePlan(plan.id, user.id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "删除计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
