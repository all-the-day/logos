import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getTodayTasks, getTodaySummary } from "@/services/learn";
import { rateCard } from "@/services/card";
import { RATING } from "@/lib/fsrs";
import { prisma } from "@/lib/prisma";
import {
  ALICE_ID,
  BOB_ID,
  FIXED_NOW,
  clearDb,
  seedBase,
  seedWithManyDueReviews,
} from "@/tests/fixtures/seed-test";

function freezeTime() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
}

/**
 * 学习队列集成测试。
 * 先跑当前实现观察结果；若测试失败，先确认根因再修实现（见提交说明）。
 */
describe("学习队列基础语义（alice：活跃计划 book1 / versesPerDay=2）", () => {
  beforeAll(async () => {
    freezeTime();
    await seedBase();
  });
  afterAll(() => vi.useRealTimers());

  it("1. 没有激活计划时返回空队列和零摘要", async () => {
    const tasks = await getTodayTasks(BOB_ID);
    expect(tasks.plan).toBeNull();
    expect(tasks.tasks).toEqual([]);

    const summary = await getTodaySummary(BOB_ID);
    expect(summary).toEqual({ review: 0, new: 0 });
  });

  it("2. state=new 的卡片绝不能进入复习部分", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    expect(tasks.length).toBe(7); // 5 复习（book1×4 + 已删计划 book2 的 v401）+ 2 新卡
    const reviewTasks = tasks.filter((t) => t.cardState !== "new");
    const newTasks = tasks.filter((t) => t.cardState === "new");
    expect(reviewTasks.length).toBe(5);
    expect(newTasks.length).toBe(2);
    for (const t of reviewTasks) expect(t.cardState).not.toBe("new");
  });

  it("3. 其他用户的卡片不得进入队列；新卡引入仅限当前计划书卷", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);

    // 其他用户：bob 的卡（含 book1 上的卡）不得出现在 alice 队列
    const bobCards = await prisma.card.findMany({
      where: { userId: BOB_ID },
      select: { id: true },
    });
    const bobCardIds = new Set(bobCards.map((c) => c.id));
    for (const t of tasks) {
      expect(bobCardIds.has(t.cardId)).toBe(false);
    }

    // 新卡引入仅限当前计划书卷：book2 的新卡 v402 不得进入新卡部分
    const newTasks = tasks.filter((t) => t.cardState === "new");
    const newVerseIds = newTasks.map((t) => t.id);
    expect(newVerseIds).not.toContain(402);
  });

  it("4. 已删除计划的到期复习卡仍进入复习队列（卡片是永久学习资产）", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const reviewTasks = tasks.filter((t) => t.cardState !== "new");
    const reviewVerseIds = reviewTasks.map((t) => t.id);
    const newTasks = tasks.filter((t) => t.cardState === "new");
    const newVerseIds = newTasks.map((t) => t.id);
    // book2（已删除计划）的到期复习卡 v401 进入复习；其新卡 v402 不进入新卡引入
    expect(reviewVerseIds).toContain(401);
    expect(newVerseIds).not.toContain(402);
  });

  it("5. due < now 与 due === now 被选中，due > now 被排除", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const verseIds = tasks.map((t) => t.id);
    expect(verseIds).toContain(102); // due === now
    expect(verseIds).toContain(101); // due < now
    expect(verseIds).not.toContain(103); // due > now（relearning）
  });

  it("6. 新卡最多为 versesPerDay，超出部分不取", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const newTasks = tasks.filter((t) => t.cardState === "new");
    expect(newTasks.length).toBe(2); // versesPerDay=2
    const summary = await getTodaySummary(ALICE_ID);
    expect(summary.new).toBe(2);
  });

  it("7. 新卡按章、节顺序排列", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const newTasks = tasks.filter((t) => t.cardState === "new");
    const verseIds = newTasks.map((t) => t.id);
    expect(verseIds).toEqual([301, 302]);
  });

  it("8. 复习卡按 due 升序、stability 升序、verseId 升序排列", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const reviewTasks = tasks.filter((t) => t.cardState !== "new");
    const verseIds = reviewTasks.map((t) => t.id);
    expect(verseIds).toEqual([202, 201, 101, 401, 102]); // v101 与 v401 同为 -1d，按 verseId 排序
  });

  it("9. 相同 now 下摘要与队列数量一致", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const summary = await getTodaySummary(ALICE_ID);

    const reviewCount = tasks.filter((t) => t.cardState !== "new").length;
    const newCount = tasks.filter((t) => t.cardState === "new").length;

    expect(summary.review).toBe(reviewCount);
    expect(summary.new).toBe(newCount);
    expect(summary.review).toBe(5);
    expect(summary.new).toBe(2);
  });

  it("10. 显式传入 now 时任务与摘要行为一致（无需冻结时间）", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID, FIXED_NOW);
    const summary = await getTodaySummary(ALICE_ID, FIXED_NOW);
    expect(tasks.length).toBe(7);
    expect(summary.review).toBe(5);
    expect(summary.new).toBe(2);
  });

  it("11. now 越过 v103 到期日后，v103 进入复习队列", async () => {
    const later = new Date(FIXED_NOW.getTime() + 2 * 86400000);
    const { tasks } = await getTodayTasks(ALICE_ID, later);
    const verseIds = tasks.map((t) => t.id);
    expect(verseIds).toContain(103);
    const summary = await getTodaySummary(ALICE_ID, later);
    expect(summary.review).toBe(6); // 5 基础 + v103
  });
});

describe("学习队列上限（超过 50 张到期复习卡）", () => {
  beforeAll(async () => {
    freezeTime();
    await seedWithManyDueReviews(55); // 基础 5 + 55 = 60 张到期
  });
  afterAll(() => vi.useRealTimers());

  it("到期复习卡超过 50 时，任务与摘要均为 50", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const reviewTasks = tasks.filter((t) => t.cardState !== "new");
    expect(reviewTasks.length).toBe(50);
    expect(tasks.length).toBe(52); // 50 复习 + 2 新卡

    const summary = await getTodaySummary(ALICE_ID);
    expect(summary.review).toBe(50);
    expect(summary.new).toBe(2);
  });
});

describe("每日新卡配额（introducedAt 首次引入计数）", () => {
  beforeAll(async () => {
    freezeTime();
    await clearDb();
    await prisma.user.create({ data: { id: ALICE_ID, username: "alice", name: "爱丽丝", passwordHash: "x" } });
    await prisma.book.create({ data: { id: 1, name: "测试卷一", chapters: 3 } });
    await prisma.verse.createMany({
      data: [
        { id: 301, bookId: 1, chapter: 3, verse: 1, content: "经301", kjv: null },
        { id: 302, bookId: 1, chapter: 3, verse: 2, content: "经302", kjv: null },
        { id: 303, bookId: 1, chapter: 3, verse: 3, content: "经303", kjv: null },
        { id: 304, bookId: 1, chapter: 3, verse: 4, content: "经304", kjv: null },
      ],
    });
    await prisma.plan.create({ data: { id: 1, userId: ALICE_ID, bookId: 1, versesPerDay: 2, status: "active" } });
    await prisma.card.createMany({
      data: [301, 302, 303, 304].map((verseId) => ({
        userId: ALICE_ID,
        verseId,
        state: "new",
        due: FIXED_NOW,
        stability: 2.0,
        difficulty: 5.0,
        reps: 0,
        lapses: 0,
        lastReview: null,
      })),
    });
  });
  afterAll(() => vi.useRealTimers());

  it("当天学满 versesPerDay 张新卡后，再次获取今日任务不再出新卡", async () => {
    const first = await getTodayTasks(ALICE_ID);
    const firstNew = first.tasks.filter((t) => t.cardState === "new").map((t) => t.id);
    expect(firstNew).toEqual([301, 302]);

    const c301 = (await prisma.card.findMany({ where: { userId: ALICE_ID, verseId: 301 } }))[0];
    const c302 = (await prisma.card.findMany({ where: { userId: ALICE_ID, verseId: 302 } }))[0];
    await rateCard(ALICE_ID, c301.id, RATING.GOOD);
    await rateCard(ALICE_ID, c302.id, RATING.GOOD);

    const again = await getTodayTasks(ALICE_ID);
    expect(again.tasks.filter((t) => t.cardState === "new")).toEqual([]);
    const summary = await getTodaySummary(ALICE_ID);
    expect(summary.new).toBe(0);

    // introducedAt 已写入；重学（AGAIN）不改变今日引入计数
    const c301After = (await prisma.card.findMany({ where: { userId: ALICE_ID, verseId: 301 } }))[0];
    expect(c301After.introducedAt).toBeInstanceOf(Date);
    await rateCard(ALICE_ID, c301After.id, RATING.AGAIN);
    const summaryAfterAgain = await getTodaySummary(ALICE_ID);
    expect(summaryAfterAgain.new).toBe(0);
  });

  it("次日配额重置，继续引入下一批新卡", async () => {
    const tomorrow = new Date(FIXED_NOW.getTime() + 86400000);
    const { tasks } = await getTodayTasks(ALICE_ID, tomorrow);
    const newVerseIds = tasks.filter((t) => t.cardState === "new").map((t) => t.id);
    expect(newVerseIds).toEqual([303, 304]);
  });
});
