import { NextResponse } from "next/server";
import * as cardDb from "@/db/card";
import {
  updateCard,
  RATING,
} from "@/lib/fsrs";
import type { FsrsCard, Rating } from "@/lib/fsrs";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/date";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const body = JSON.parse(text);
    const { cardId, verseId, rating } = body;

    if ((!cardId && !verseId) || rating === undefined) {
      return NextResponse.json({ error: "缺少参数 (cardId 或 verseId)" }, { status: 400 });
    }

    if (![RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY].includes(rating)) {
      return NextResponse.json({ error: "无效评级" }, { status: 400 });
    }

    // Get current card from DB (scoped to user)
    let existingCard;
    if (cardId) {
      existingCard = await cardDb.getCardById(cardId, user.id);
    } else if (verseId) {
      const cards = await cardDb.getCardsForVerse(verseId, user.id);
      // Use the most recent card (last in array — ordered by creation)
      existingCard = cards.length > 0 ? cards[cards.length - 1] : null;
    }
    if (!existingCard) {
      return NextResponse.json({ error: "卡片不存在" }, { status: 404 });
    }

    // Convert DB card to FsrsCard format
    const fsrsCard: FsrsCard = {
      id: existingCard.id,
      verseId: existingCard.verseId,
      stability: existingCard.stability,
      difficulty: existingCard.difficulty,
      reps: existingCard.reps,
      lapses: existingCard.lapses,
      state: existingCard.state as FsrsCard["state"],
      lastReview: existingCard.lastReview,
      due: existingCard.due,
    };

    // Apply FSRS update
    const updated = updateCard(fsrsCard, rating as Rating);

    // Save to DB (scoped to user)
    const savedCard = await cardDb.updateCard(existingCard.id, user.id, {
      stability: updated.stability,
      difficulty: updated.difficulty,
      reps: updated.reps,
      lapses: updated.lapses,
      state: updated.state,
      lastReview: updated.lastReview,
      due: updated.due,
    });

    if (!savedCard) {
      return NextResponse.json({ error: "卡片不存在" }, { status: 404 });
    }

    return NextResponse.json({
      card: savedCard,
      nextInterval: Math.round(
        (updated.due.getTime() - Date.now()) / 86400000
      ),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新卡片失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const verseId = searchParams.get("verseId");

    if (verseId) {
      const cards = await cardDb.getCardsForVerse(parseInt(verseId), user.id);
      return NextResponse.json({ cards });
    }

    const cards = await cardDb.getDueCards(user.id);
    return NextResponse.json({ cards });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取卡片失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { cardId, stability, difficulty, reps, lapses, state, lastReview, due } = JSON.parse(text);

    if (!cardId) {
      return NextResponse.json({ error: "缺少 cardId" }, { status: 400 });
    }

    // 边界校验：只允许合法日期写入 DB（DB 层只接收 Date）
    const parsedLastReview = parseDateInput(lastReview);
    const parsedDue = parseDateInput(due);
    if ((lastReview != null && !parsedLastReview) || (due != null && !parsedDue)) {
      return NextResponse.json({ error: "无效的日期字段" }, { status: 400 });
    }

    const restored = await cardDb.updateCard(cardId, user.id, {
      stability,
      difficulty,
      reps,
      lapses,
      state,
      lastReview: parsedLastReview,
      due: parsedDue ?? undefined,
    });

    if (!restored) {
      return NextResponse.json({ error: "卡片不存在" }, { status: 404 });
    }

    return NextResponse.json({ card: restored });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "恢复卡片失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
