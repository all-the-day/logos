import { NextResponse } from "next/server";
import * as planService from "@/services/plan";
import * as planDb from "@/db/plan";
import * as cardDb from "@/db/card";
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

    // 为新书卷补建缺失卡片（幂等）
    await planService.ensureCardsForBook(user.id, bookId);

    return NextResponse.json({ plan });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建计划失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { bookId, versesPerDay } = JSON.parse(text);
    if (versesPerDay === undefined || !Number.isInteger(versesPerDay) || versesPerDay < 1 || versesPerDay > 10) {
      return NextResponse.json({ error: "每日节数需为 1-10 的整数" }, { status: 400 });
    }

    const plan = await planService.updatePlan(user.id, {
      ...(bookId ? { bookId } : {}),
      versesPerDay,
    });
    if (!plan) {
      return NextResponse.json({ error: "没有活动计划" }, { status: 404 });
    }

    // 换书卷时为新书卷补建缺失卡片（幂等；旧书卷卡片保留，复习队列跨全部已学书卷）
    if (bookId) {
      await planService.ensureCardsForBook(user.id, bookId);
    }

    return NextResponse.json({ plan });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新计划失败";
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
