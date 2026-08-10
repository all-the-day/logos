import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  updateCard,
  recommendRating,
  RATING,
  STATE,
  INITIAL_STABILITY,
  INITIAL_DIFFICULTY,
  type FsrsCard,
  type Rating,
} from "@/lib/fsrs";

// 固定时间：2026-08-07 12:00 (+08:00)
const FIXED_TIME = new Date("2026-08-07T04:00:00.000Z");
const DAY_MS = 86400000;

function makeCard(overrides: Partial<FsrsCard> = {}): FsrsCard {
  return {
    verseId: 4501001,
    stability: INITIAL_STABILITY,
    difficulty: INITIAL_DIFFICULTY,
    reps: 0,
    lapses: 0,
    state: STATE.NEW,
    lastReview: null,
    due: FIXED_TIME,
    ...overrides,
  };
}

function invalidRating(): Rating {
  return 5 as unknown as Rating;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TIME);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("updateCard 基本不变量", () => {
  it("非法评级抛出异常", () => {
    expect(() => updateCard(makeCard(), invalidRating())).toThrow();
    expect(() => updateCard(makeCard(), 0 as unknown as Rating)).toThrow();
  });

  it("任意评级后 due 均晚于 lastReview，稳定性恒 > 0", () => {
    for (const rating of [RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY]) {
      const r = updateCard(makeCard(), rating);
      expect(r.stability).toBeGreaterThan(0);
      expect(r.due.getTime()).toBeGreaterThan(r.lastReview!.getTime());
    }
  });

  it("非 AGAIN 时 reps 恰好 +1，lapses 不变；AGAIN 时 reps 归零、lapses +1", () => {
    const c = makeCard({ state: STATE.REVIEW, stability: 10, reps: 3, lapses: 2 });
    const good = updateCard(c, RATING.GOOD);
    expect(good.reps).toBe(4);
    expect(good.lapses).toBe(2);

    const again = updateCard(c, RATING.AGAIN);
    expect(again.reps).toBe(0);
    expect(again.lapses).toBe(3);
  });
});

describe("updateCard 新卡", () => {
  it("GOOD：进入学习态，stability 2.0，间隔 1 天", () => {
    const r = updateCard(makeCard(), RATING.GOOD);
    expect(r.state).toBe(STATE.LEARNING);
    expect(r.stability).toBeCloseTo(2.0, 5);
    expect(r.difficulty).toBeCloseTo(4.85, 5);
    expect(r.lastReview).toEqual(FIXED_TIME);
    expect(r.due.getTime()).toBe(FIXED_TIME.getTime() + 1 * DAY_MS);
  });

  it("EASY：间隔 3 天，stability 4.0", () => {
    const r = updateCard(makeCard(), RATING.EASY);
    expect(r.state).toBe(STATE.LEARNING);
    expect(r.stability).toBeCloseTo(4.0, 5);
    expect(r.due.getTime()).toBe(FIXED_TIME.getTime() + 3 * DAY_MS);
  });

  it("AGAIN：进入重学态，stability 降为 0.5，间隔 1 天，lapses+1", () => {
    const r = updateCard(makeCard(), RATING.AGAIN);
    expect(r.state).toBe(STATE.RELEARNING);
    expect(r.stability).toBeCloseTo(0.5, 5);
    expect(r.reps).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.due.getTime()).toBe(FIXED_TIME.getTime() + 1 * DAY_MS);
  });
});

describe("updateCard 状态转移", () => {
  it("学习态连续 GOOD，第三次达到 3 次进入复习态", () => {
    let c = updateCard(makeCard(), RATING.GOOD); // reps=1
    expect(c.state).toBe(STATE.LEARNING);
    c = updateCard(c, RATING.GOOD); // reps=2
    expect(c.state).toBe(STATE.LEARNING);
    c = updateCard(c, RATING.GOOD); // reps=3
    expect(c.state).toBe(STATE.REVIEW);
  });

  it("复习卡 AGAIN：进入重学态", () => {
    const c = makeCard({ state: STATE.REVIEW, stability: 10, reps: 5 });
    const r = updateCard(c, RATING.AGAIN);
    expect(r.state).toBe(STATE.RELEARNING);
    expect(r.stability).toBeCloseTo(5.0, 5);
  });

  it("重学态 GOOD：直接回到复习态", () => {
    const c = makeCard({ state: STATE.RELEARNING, stability: 4, reps: 0, lapses: 1 });
    const r = updateCard(c, RATING.GOOD);
    expect(r.state).toBe(STATE.REVIEW);
  });
});

describe("updateCard 数值边界", () => {
  it("difficulty 被夹在 [1, 10]", () => {
    const high = updateCard(makeCard({ difficulty: 9.5 }), RATING.AGAIN);
    expect(high.difficulty).toBeCloseTo(10.0, 5);
    const low = updateCard(makeCard({ difficulty: 1.2 }), RATING.EASY);
    expect(low.difficulty).toBeCloseTo(1.0, 5);
  });

  it("复习卡 stability 衰减不低于下限 0.5", () => {
    const c = makeCard({ state: STATE.REVIEW, stability: 0.4, reps: 3 });
    const r = updateCard(c, RATING.AGAIN);
    expect(r.stability).toBeCloseTo(0.5, 5);
  });

  it("复习卡 GOOD 间隔 = round(stability × 2.25)", () => {
    const c = makeCard({ state: STATE.REVIEW, stability: 10, reps: 3 });
    const r = updateCard(c, RATING.GOOD);
    expect(r.stability).toBeCloseTo(25.0, 5);
    const interval = Math.round(25.0 * 2.25);
    expect(r.due.getTime()).toBe(FIXED_TIME.getTime() + interval * DAY_MS);
  });

  it("复习卡间隔满足 EASY ≥ GOOD ≥ HARD", () => {
    const base = makeCard({ state: STATE.REVIEW, stability: 10, reps: 3 });
    const day = (rating: number) =>
      updateCard(base, rating).due.getTime() - FIXED_TIME.getTime();
    expect(day(RATING.EASY)).toBeGreaterThanOrEqual(day(RATING.GOOD));
    expect(day(RATING.GOOD)).toBeGreaterThanOrEqual(day(RATING.HARD));
  });
});

describe("recommendRating 准确率边界", () => {
  it("边界值与临界值", () => {
    expect(recommendRating(1)).toBe(RATING.EASY);
    expect(recommendRating(0.95)).toBe(RATING.EASY);
    expect(recommendRating(0.9499)).toBe(RATING.GOOD);
    expect(recommendRating(0.85)).toBe(RATING.GOOD);
    expect(recommendRating(0.8499)).toBe(RATING.HARD);
    expect(recommendRating(0.6)).toBe(RATING.HARD);
    expect(recommendRating(0.5999)).toBe(RATING.AGAIN);
    expect(recommendRating(0)).toBe(RATING.AGAIN);
  });
});
