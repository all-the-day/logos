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

    // 停用旧计划（软删）；不删除旧书卷卡片——卡片是永久学习资产，旧书卷到期卡继续进复习
    const existing = await planDb.getActivePlan(user.id);
    if (existing) {
      await planDb.deletePlan(existing.id, user.id);
    }

    const plan = await planService.initializePlan(user.id, bookId, versesPerDay);

    // 为新书卷补建缺失卡片（幂等：已存在的卡不重复创建，避免 @@unique([userId, verseId]) 冲突）
    const verses = await verseDb.getVersesByBook(bookId);
    if (verses.length > 0) {
      const existingCards = await cardDb.getExistingCardVerseIds(user.id, verses.map((v) => v.id));
      const toCreate = verses.map((v) => v.id).filter((id) => !existingCards.has(id));
      if (toCreate.length > 0) {
        await cardDb.createCards(user.id, toCreate);
      }
    }

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
      // 只软删计划，不删卡片（卡片是永久学习资产，旧书卷到期卡继续进复习队列）
      await planDb.deletePlan(plan.id, user.id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "删除计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
