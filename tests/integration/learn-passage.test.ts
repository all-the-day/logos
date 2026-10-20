import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clearDb, ALICE_ID } from "../fixtures/seed-test";
import { getTodayTasks } from "@/services/learn";

async function seedPassage(size = 5) {
  await clearDb();
  await prisma.user.create({ data: { id: ALICE_ID, username: "alice", name: "爱丽丝", passwordHash: "x" } });
  await prisma.book.create({ data: { id: 1, name: "罗马书", chapters: 1 } });
  await prisma.verse.createMany({
    data: [1, 2, 3, 4, 5, 6, 7].map((v) => ({
      id: 100 + v,
      bookId: 1,
      chapter: 1,
      verse: v,
      content: `第${v}节经文`,
      kjv: null,
    })),
  });
  await prisma.card.createMany({
    data: [1, 2, 3, 4, 5, 6, 7].map((v) => ({
      userId: ALICE_ID,
      verseId: 100 + v,
      state: "new",
      due: new Date("2026-08-07T04:00:00.000Z"),
    })),
  });
  await prisma.plan.create({
    data: {
      id: 1,
      userId: ALICE_ID,
      bookId: 1,
      versesPerDay: 5,
      status: "active",
      reciteMode: "passage",
      passageSize: size,
    },
  });
}

describe("连背模式分组（passage）", () => {
  beforeEach(() => seedPassage(5));
  afterEach(clearDb);

  it("按 passageSize 分组，content 为拼接原文，cardIds 覆盖组内卡片", async () => {
    const { tasks } = await getTodayTasks(ALICE_ID);
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task.isPassage).toBe(true);
    expect(task.verse).toBe(1);
    expect(task.verseEnd).toBe(5);
    expect(task.content).toBe("第1节经文第2节经文第3节经文第4节经文第5节经文");
    expect(task.cardIds).toHaveLength(5);
    expect(task.cardState).toBe("new");
  });

  it("剩余不足一组的落单经节回退为普通单节任务", async () => {
    await prisma.plan.update({ where: { id: 1 }, data: { versesPerDay: 7, passageSize: 3 } });
    const { tasks } = await getTodayTasks(ALICE_ID);
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.verseEnd)).toEqual([3, 6, undefined]);
    // 落单的第 7 节不是连背任务，无 cardIds，走普通单节流程
    expect(tasks[2].isPassage).toBeUndefined();
    expect(tasks[2].cardIds).toBeUndefined();
    expect(tasks[2].verse).toBe(7);
  });

  it("节号不连续时断组：连续的成组，孤立的回退单节（复习队列）", async () => {
    // 第 2、3、7 节为到期复习卡（同章但 7 与 3 不连续），每日新卡配额 1 → 第 1 节新卡
    const now = new Date();
    await prisma.card.updateMany({
      where: { verseId: { in: [102, 103, 107] } },
      data: { state: "review", due: now },
    });
    await prisma.plan.update({ where: { id: 1 }, data: { versesPerDay: 1 } });

    const { tasks } = await getTodayTasks(ALICE_ID, now);
    // 复习组在前：[2,3] 成连背组，7 落单回退单节；新卡 1 在最后（配额 1，落单单节）
    expect(tasks).toHaveLength(3);
    expect(tasks[0].isPassage).toBe(true);
    expect(tasks[0].verse).toBe(2);
    expect(tasks[0].verseEnd).toBe(3);
    expect(tasks[0].cardIds).toHaveLength(2);
    expect(tasks[1].isPassage).toBeUndefined();
    expect(tasks[1].verse).toBe(7);
    expect(tasks[2].isPassage).toBeUndefined();
    expect(tasks[2].verse).toBe(1);
  });

  it("单节模式不分组，仍是逐节任务", async () => {
    await prisma.plan.update({ where: { id: 1 }, data: { reciteMode: "single" } });
    const { tasks } = await getTodayTasks(ALICE_ID);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((t) => !t.isPassage)).toBe(true);
    expect(tasks.map((t) => t.verse)).toEqual([1, 2, 3, 4, 5]);
  });
});
