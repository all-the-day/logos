import * as cardDb from "@/db/card";
import { updateCard, type FsrsCard, type Rating } from "@/lib/fsrs";

/**
 * 评分写路径的业务逻辑：读取卡片 → FSRS 更新 → 落库。
 * 首次离开 new 态时写入 introducedAt（用于每日新卡配额），重学不再覆盖。
 * 返回 null 表示卡片不存在或不属于该用户。
 */
export async function rateCard(userId: number, cardId: number, rating: Rating) {
  const existing = await cardDb.getCardById(cardId, userId);
  if (!existing) return null;

  const fsrsCard: FsrsCard = {
    id: existing.id,
    verseId: existing.verseId,
    stability: existing.stability,
    difficulty: existing.difficulty,
    reps: existing.reps,
    lapses: existing.lapses,
    state: existing.state as FsrsCard["state"],
    lastReview: existing.lastReview,
    due: existing.due,
  };

  const updated = updateCard(fsrsCard, rating);

  const wasNew = existing.state === "new";
  // 首次离开 new 态时写入 introducedAt（updateCard 会把 lastReview 置为 now）
  const introducedAt =
    wasNew && updated.state !== "new" ? updated.lastReview ?? new Date() : undefined;
  const saved = await cardDb.updateCard(existing.id, userId, {
    stability: updated.stability,
    difficulty: updated.difficulty,
    reps: updated.reps,
    lapses: updated.lapses,
    state: updated.state,
    lastReview: updated.lastReview,
    due: updated.due,
    ...(introducedAt ? { introducedAt } : {}),
  });

  if (!saved) return null;

  return {
    card: saved,
    nextInterval: Math.round((updated.due.getTime() - Date.now()) / 86400000),
  };
}
