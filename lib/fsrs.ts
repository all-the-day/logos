/**
 * FSRS 简化版算法
 * 参考文献：https://github.com/open-spaced-repetition/ts-fsrs
 *
 * 背经场景，单节颗粒度：1 经节 = 1 卡片
 * 评级：1=Again, 2=Hard, 3=Good, 4=Easy
 */

export const RATING = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
} as const;

export type Rating = (typeof RATING)[keyof typeof RATING];

export const STATE = {
  NEW: "new",
  LEARNING: "learning",
  REVIEW: "review",
  RELEARNING: "relearning",
} as const;

export type CardState = (typeof STATE)[keyof typeof STATE];

export interface FsrsCard {
  id?: number;
  verseId: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: Date | null;
  due: Date;
}

const DIFFICULTY_MIN = 1.0;
const DIFFICULTY_MAX = 10.0;
const STABILITY_MIN = 0.5;
const INTERVAL_FACTOR = 2.25;
const MAX_INTERVAL = 1825; // 5 年
const LEARNING_THRESHOLD = 3;
const DAY_MS = 86400000;

// 新卡初始值（与 prisma/schema.prisma 中 Card 默认值保持一致）
export const INITIAL_STABILITY = 2.0;
export const INITIAL_DIFFICULTY = 5.0;

const D_DELTA: Record<Rating, number> = {
  [RATING.AGAIN]: 1.0,
  [RATING.HARD]: 0.5,
  [RATING.GOOD]: -0.15,
  [RATING.EASY]: -0.3,
};

const STABILITY_FACTOR: Record<number, number> = {
  [RATING.HARD]: 1.2,
  [RATING.GOOD]: 2.5,
  [RATING.EASY]: 3.5,
};

/** 更新 FSRS 卡片状态 */
export function updateCard(card: FsrsCard, rating: Rating): FsrsCard {
  if (![1, 2, 3, 4].includes(rating)) {
    throw new Error(`Invalid rating: ${rating}`);
  }

  const now = new Date();
  const stability = calcStability(card, rating);
  const reps = rating === RATING.AGAIN ? 0 : card.reps + 1;
  const lapses = rating === RATING.AGAIN ? card.lapses + 1 : card.lapses;
  const difficulty = Math.max(
    DIFFICULTY_MIN,
    Math.min(DIFFICULTY_MAX, card.difficulty + D_DELTA[rating])
  );
  const interval = calcInterval(card, rating, stability);
  const state = calcState(card, rating, reps);
  const due = new Date(now.getTime() + interval * DAY_MS);

  return {
    ...card,
    stability,
    difficulty,
    reps,
    lapses,
    state,
    lastReview: now,
    due,
  };
}

function calcStability(card: FsrsCard, rating: Rating): number {
  if (card.state === STATE.NEW) {
    if (rating === RATING.AGAIN) return STABILITY_MIN;
    if (rating === RATING.HARD) return 1.0;
    if (rating === RATING.GOOD) return 2.0;
    return 4.0;
  }
  if (rating === RATING.AGAIN) {
    return Math.max(STABILITY_MIN, card.stability * 0.5);
  }
  const factor = STABILITY_FACTOR[rating] || 2.5;
  return card.stability * factor;
}

function calcInterval(
  card: FsrsCard,
  rating: Rating,
  stability: number
): number {
  if (rating === RATING.AGAIN) return 1;
  if (card.state === STATE.NEW) {
    return rating === RATING.EASY ? 3 : 1;
  }
  return Math.max(
    1,
    Math.min(MAX_INTERVAL, Math.round(stability * INTERVAL_FACTOR))
  );
}

function calcState(
  card: FsrsCard,
  rating: Rating,
  reps: number
): CardState {
  if (rating === RATING.AGAIN) return STATE.RELEARNING;
  if (reps >= LEARNING_THRESHOLD) return STATE.REVIEW;
  if (card.state === STATE.NEW || card.state === STATE.LEARNING) {
    return STATE.LEARNING;
  }
  return STATE.REVIEW;
}

/**
 * 根据 LCS 比对准确率推荐评级（用户可手动覆盖）。
 * - ≥ 0.95：基本正确，记 EASY
 * - ≥ 0.85：少量错误，记 GOOD
 * - ≥ 0.6：明显卡顿，记 HARD
 * - < 0.6：多半忘了，记 AGAIN
 */
export function recommendRating(accuracy: number): Rating {
  if (accuracy >= 0.95) return RATING.EASY;
  if (accuracy >= 0.85) return RATING.GOOD;
  if (accuracy >= 0.6) return RATING.HARD;
  return RATING.AGAIN;
}
