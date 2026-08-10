import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getTodayTasks, getTodaySummary } from "@/services/learn";
import { prisma } from "@/lib/prisma";
import {
  ALICE_ID,
  BOB_ID,
  FIXED_NOW,
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
    expect(tasks.length).toBe(6); // 4 复习 + 2 新卡
    const reviewTasks = tasks.filter((t) => t.cardState !== "new");
    const newTasks = tasks.filter((t) => t.cardState === "new");
    expect(reviewTasks.length).toBe(4);
    expect(newTasks.length).toBe(2);
    for (const t of reviewTasks) expect(t.cardState).not.toBe("new");
  });

  it("3. 其他用户、其他书卷、已删除计划的数据不得进入队列", async () => {
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

    // 其他书卷 / 已删除计划：book2 的经节不得出现
    const verseIds = tasks.map((t) => t.id);
    expect(verseIds).not.toContain(401);
    expect(verseIds).not.toContain(402);
  });

  it("4. 已删除计划对应的数据不得进入队列", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const verseIds = tasks.map((t) => t.id);
    // alice 在 book2（已删除计划的书）有到期 review 卡 v401 与新卡 v402
    expect(verseIds).not.toContain(401);
    expect(verseIds).not.toContain(402);
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

  it("8. 复习卡按 due 升序、stability 升序排列", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const reviewTasks = tasks.filter((t) => t.cardState !== "new");
    const verseIds = reviewTasks.map((t) => t.id);
    expect(verseIds).toEqual([202, 201, 101, 102]);
  });

  it("9. 相同 now 下摘要与队列数量一致", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    const summary = await getTodaySummary(ALICE_ID);

    const reviewCount = tasks.filter((t) => t.cardState !== "new").length;
    const newCount = tasks.filter((t) => t.cardState === "new").length;

    expect(summary.review).toBe(reviewCount);
    expect(summary.new).toBe(newCount);
    expect(summary.review).toBe(4);
    expect(summary.new).toBe(2);
  });

  it("10. 显式传入 now 时任务与摘要行为一致（无需冻结时间）", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID, FIXED_NOW);
    const summary = await getTodaySummary(ALICE_ID, FIXED_NOW);
    expect(tasks.length).toBe(6);
    expect(summary.review).toBe(4);
    expect(summary.new).toBe(2);
  });

  it("11. now 越过 v103 到期日后，v103 进入复习队列", async () => {
    const later = new Date(FIXED_NOW.getTime() + 2 * 86400000);
    const { tasks } = await getTodayTasks(ALICE_ID, later);
    const verseIds = tasks.map((t) => t.id);
    expect(verseIds).toContain(103);
    const summary = await getTodaySummary(ALICE_ID, later);
    expect(summary.review).toBe(5); // 4 基础 + v103
  });
});

describe("学习队列上限（超过 50 张到期复习卡）", () => {
  beforeAll(async () => {
    freezeTime();
    await seedWithManyDueReviews(55); // 基础 4 + 55 = 59 张到期
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
