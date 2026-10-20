import { NextResponse } from "next/server";
import * as cardDb from "@/db/card";
import * as cardService from "@/services/card";
import { RATING } from "@/lib/fsrs";
import { requireUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/date";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const body = JSON.parse(text);
    const { cardId, verseId, rating, ratings } = body;

    // 连背模式：一组一评，ratings 为 [{cardId, rating}, ...]
    if (Array.isArray(ratings)) {
      if (ratings.length === 0) {
        return NextResponse.json({ error: "缺少参数 (ratings)" }, { status: 400 });
      }
      for (const item of ratings) {
        if (!item?.cardId || ![RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY].includes(item.rating)) {
          return NextResponse.json({ error: "无效评级" }, { status: 400 });
        }
      }

      // 先整体校验所有权，再逐卡写入：避免中途 404 造成半组已写、客户端重试时双写
      for (const item of ratings) {
        const existing = await cardDb.getCardById(item.cardId, user.id);
        if (!existing) {
          return NextResponse.json({ error: `卡片不存在: ${item.cardId}` }, { status: 404 });
        }
      }

      const cards = [];
      for (const item of ratings) {
        const result = await cardService.rateCard(user.id, item.cardId, item.rating);
        if (!result) {
          return NextResponse.json({ error: `卡片不存在: ${item.cardId}` }, { status: 404 });
        }
        cards.push(result.card);
      }

      return NextResponse.json({ cards });
    }

    if ((!cardId && !verseId) || rating === undefined) {
      return NextResponse.json({ error: "缺少参数 (cardId 或 verseId)" }, { status: 400 });
    }

    if (![RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY].includes(rating)) {
      return NextResponse.json({ error: "无效评级" }, { status: 400 });
    }

    // 解析出卡片 id（scoped to user）
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

    const result = await cardService.rateCard(user.id, existingCard.id, rating);
    if (!result) {
      return NextResponse.json({ error: "卡片不存在" }, { status: 404 });
    }

    return NextResponse.json({
      card: result.card,
      nextInterval: result.nextInterval,
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
    const { cardId, stability, difficulty, reps, lapses, state, lastReview, due, cards } = JSON.parse(text);

    // 连背模式撤销：cards 为 [{cardId, stability, ...}, ...]
    if (Array.isArray(cards)) {
      if (cards.length === 0) {
        return NextResponse.json({ error: "缺少参数 (cards)" }, { status: 400 });
      }

      const validateItem = (item: { cardId?: number; lastReview?: unknown; due?: unknown }): string | null => {
        if (!item?.cardId) return "缺少 cardId";
        const parsedLastReview = parseDateInput(item.lastReview);
        const parsedDue = parseDateInput(item.due);
        if ((item.lastReview != null && !parsedLastReview) || (item.due != null && !parsedDue)) {
          return "无效的日期字段";
        }
        return null;
      };

      // 先整体校验参数与所有权，再逐卡恢复：避免中途失败造成半组恢复
      for (const item of cards) {
        const err = validateItem(item);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        const existing = await cardDb.getCardById(item.cardId, user.id);
        if (!existing) {
          return NextResponse.json({ error: `卡片不存在: ${item.cardId}` }, { status: 404 });
        }
      }

      const restoredCards = [];
      for (const item of cards) {
        const restored = await cardDb.updateCard(item.cardId, user.id, {
          stability: item.stability,
          difficulty: item.difficulty,
          reps: item.reps,
          lapses: item.lapses,
          state: item.state,
          lastReview: parseDateInput(item.lastReview),
          due: parseDateInput(item.due) ?? undefined,
        });
        if (!restored) {
          return NextResponse.json({ error: `卡片不存在: ${item.cardId}` }, { status: 404 });
        }
        restoredCards.push(restored);
      }

      return NextResponse.json({ cards: restoredCards });
    }

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
