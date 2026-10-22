import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clearDb, ALICE_ID, BOB_ID } from "../fixtures/seed-test";
import {
  getChapterInfo,
  getPracticeTasks,
  startPractice,
} from "@/services/practice";
import { ensureCardsForVerses } from "@/services/plan";
import { MAX_PRACTICE_VERSES, parsePracticeParams } from "@/lib/practice";

const BOOK_ID = 50;

/**
 * 腓立比书风格夹具：
 * - 第 4 章 1-8 节（正常连续）
 * - 第 1 章：含 verse=0 的篇首标题 + 第 1 节（验证 0 节被排除、章节隔离）
 * - 第 5 章 1-51 节（验证按真实条数拒绝超额）
 * - 第 6 章 1-49、51 节（跨度 51 但实际 50 节，验证不被跨度误拒）
 */
async function seedPractice() {
  await clearDb();
  await prisma.user.create({
    data: { id: ALICE_ID, username: "alice", name: "爱丽丝", passwordHash: "x" },
  });
  await prisma.user.create({
    data: { id: BOB_ID, username: "bob", name: "鲍勃", passwordHash: "x" },
  });
  await prisma.book.create({ data: { id: BOOK_ID, name: "腓立比书", chapters: 6 } });
  await prisma.verse.createMany({
    data: [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({
        id: 5000 + v,
        bookId: BOOK_ID,
        chapter: 4,
        verse: v,
        content: `第${v}节`,
        kjv: null,
      })),
      // 篇首标题（恢复本诗篇的 section=0）与正文第 1 节
      { id: 5100, bookId: BOOK_ID, chapter: 1, verse: 0, content: "篇首标题", kjv: null },
      { id: 5101, bookId: BOOK_ID, chapter: 1, verse: 1, content: "一章一节", kjv: null },
      // 51 节：超过单次上限
      ...Array.from({ length: 51 }, (_, i) => ({
        id: 5200 + i + 1,
        bookId: BOOK_ID,
        chapter: 5,
        verse: i + 1,
        content: `五章${i + 1}节`,
        kjv: null,
      })),
      // 缺第 50 节：跨度 51，实际 50 节
      ...[...Array.from({ length: 49 }, (_, i) => i + 1), 51].map((v) => ({
        id: 5300 + v,
        bookId: BOOK_ID,
        chapter: 6,
        verse: v,
        content: `六章${v}节`,
        kjv: null,
      })),
    ],
  });
}

describe("自由练习参数校验（parsePracticeParams）", () => {
  it("缺省 from/to 时从第 1 节到章末", () => {
    const parsed = parsePracticeParams({ bookId: "50", chapter: "4" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.range).toMatchObject({
      bookId: 50,
      chapter: 4,
      from: 1,
      to: undefined,
      mode: "single",
      passageSize: 5,
    });
  });

  it("接受字符串参数并保留连背设置", () => {
    const parsed = parsePracticeParams({
      bookId: "50",
      chapter: "4",
      from: "15",
      to: "20",
      mode: "passage",
      size: "3",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.range).toMatchObject({ from: 15, to: 20, mode: "passage", passageSize: 3 });
  });

  it("拒绝缺失书卷/章与反向范围", () => {
    expect(parsePracticeParams({}).ok).toBe(false);
    expect(parsePracticeParams({ bookId: "50" }).ok).toBe(false);
    expect(parsePracticeParams({ bookId: "50", chapter: "4", from: "6", to: "3" }).ok).toBe(false);
  });

  it("节数上限交给服务端按真实条数判断（跨度可大于 50）", () => {
    // 纯参数校验不按跨度拒绝：部分章节节号不连续
    expect(parsePracticeParams({ bookId: "50", chapter: "6", from: "1", to: "51" }).ok).toBe(true);
  });

  it("连背每组节数越界时拒绝", () => {
    expect(
      parsePracticeParams({ bookId: "50", chapter: "4", mode: "passage", size: "11" }).ok
    ).toBe(false);
    expect(
      parsePracticeParams({ bookId: "50", chapter: "4", mode: "passage", size: "1" }).ok
    ).toBe(false);
  });
});

describe("自由练习服务", () => {
  beforeEach(seedPractice);
  afterEach(clearDb);

  it("章节信息返回本章节数、起止节号与实际节号列表", async () => {
    expect(await getChapterInfo(BOOK_ID, 4)).toMatchObject({
      bookId: BOOK_ID,
      chapter: 4,
      count: 8,
      firstVerse: 1,
      lastVerse: 8,
    });
    const info = await getChapterInfo(BOOK_ID, 4);
    expect(info?.verses).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await getChapterInfo(BOOK_ID, 3)).toBeNull();
  });

  it("开始练习会为缺失经节补建卡片，且幂等", async () => {
    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 4, from: 3, to: 5 });
    if (!parsed.ok) throw new Error(parsed.error);

    const first = await startPractice(ALICE_ID, parsed.range);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.count).toBe(3);
    expect(first.created).toBe(3);
    expect(first.range.to).toBe(5);

    const second = await startPractice(ALICE_ID, parsed.range);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(0);

    const cards = await prisma.card.findMany({ where: { userId: ALICE_ID } });
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.state === "new")).toBe(true);
  });

  it("to 省略时解析到本章末节", async () => {
    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 4, from: 6 });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await startPractice(ALICE_ID, parsed.range);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.to).toBe(8);
    expect(result.count).toBe(3);
  });

  it("节号超出本章范围时返回 400", async () => {
    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 4, from: 7, to: 12 });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await startPractice(ALICE_ID, parsed.range);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain("超出本章范围");
  });

  it("单节模式按节号升序构造任务，只包含自己的卡片", async () => {
    // bob 在同一批经节上已有卡片，不能被 alice 的练习命中
    await prisma.card.createMany({
      data: [4, 5].map((v) => ({ userId: BOB_ID, verseId: 5000 + v, state: "review" })),
    });

    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 4, from: 2, to: 5 });
    if (!parsed.ok) throw new Error(parsed.error);
    const started = await startPractice(ALICE_ID, parsed.range);
    if (!started.ok) throw new Error(started.error);

    const result = await getPracticeTasks(ALICE_ID, parsed.range);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks.map((t) => t.verse)).toEqual([2, 3, 4, 5]);
    expect(result.tasks.every((t) => t.cardState === "new")).toBe(true);

    const aliceCardIds = new Set(
      (await prisma.card.findMany({ where: { userId: ALICE_ID } })).map((c) => c.id)
    );
    for (const task of result.tasks) expect(aliceCardIds.has(task.cardId)).toBe(true);
  });

  it("未建卡时读取队列返回 409（旧链接/清数据后）", async () => {
    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 4, from: 1, to: 2 });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await getPracticeTasks(ALICE_ID, parsed.range);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
  });

  it("连背模式按同章连续经节分组，落单经节回退为单节任务", async () => {
    const parsed = parsePracticeParams({
      bookId: BOOK_ID,
      chapter: 4,
      from: 1,
      to: 7,
      mode: "passage",
      size: "3",
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const started = await startPractice(ALICE_ID, parsed.range);
    if (!started.ok) throw new Error(started.error);

    const result = await getPracticeTasks(ALICE_ID, parsed.range);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tasks).toHaveLength(3);
    const [g1, g2, g3] = result.tasks;
    expect(g1.isPassage).toBe(true);
    expect([g1.verse, g1.verseEnd]).toEqual([1, 3]);
    expect(g1.cardIds).toHaveLength(3);
    expect([g2.verse, g2.verseEnd]).toEqual([4, 6]);
    // 落单的第 7 节不带连背标记，保留 KJV 对照
    expect(g3.isPassage).toBeUndefined();
    expect(g3.verse).toBe(7);
  });

  it("章之间互不串节，且 verse=0 的篇首标题不参与练习", async () => {
    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 1, from: 1 });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await startPractice(ALICE_ID, parsed.range);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.to).toBe(1);
    expect(result.count).toBe(1);

    const info = await getChapterInfo(BOOK_ID, 1);
    expect(info).toMatchObject({ count: 1, firstVerse: 1, lastVerse: 1, verses: [1] });
  });

  it("补卡遇到唯一约束冲突时降级逐节写入，不抛错（并发/重复输入兜底）", async () => {
    // 重复的 verseId 会让批量 createMany 触发 @@unique([userId, verseId])，
    // 与两个标签页并发补卡时的表现一致
    const created = await ensureCardsForVerses(ALICE_ID, [5001, 5001, 5002]);
    expect(created).toBe(2);
    expect(
      await prisma.card.count({ where: { userId: ALICE_ID, verseId: { in: [5001, 5002] } } })
    ).toBe(2);
  });

  it("并发补同一批经节不会产生重复卡片", async () => {
    const verseIds = [5003, 5004, 5005];
    const results = await Promise.all([
      ensureCardsForVerses(ALICE_ID, verseIds),
      ensureCardsForVerses(ALICE_ID, verseIds),
    ]);
    expect(results.reduce((sum, n) => sum + n, 0)).toBe(3);
    expect(
      await prisma.card.count({ where: { userId: ALICE_ID, verseId: { in: verseIds } } })
    ).toBe(3);
  });

  it("按真实节数判断上限：51 节被拒", async () => {
    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 5, from: 1, to: 51 });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await startPractice(ALICE_ID, parsed.range);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain(`最多练习 ${MAX_PRACTICE_VERSES} 节`);
  });

  it("跨度超过 50 但实际只有 50 节时允许（节号不连续）", async () => {
    const parsed = parsePracticeParams({ bookId: BOOK_ID, chapter: 6, from: 1, to: 51 });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await startPractice(ALICE_ID, parsed.range);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count).toBe(MAX_PRACTICE_VERSES);
  });

  it("连背分组在新卡与已学状态切换处断开，混合组不会跳过先看再背", async () => {
    // 1-3 已学（review），4-6 从未学过（实践会新建为 new）
    await prisma.card.createMany({
      data: [1, 2, 3].map((v) => ({
        userId: ALICE_ID,
        verseId: 5000 + v,
        state: "review",
        stability: 10,
        reps: 3,
        due: new Date("2026-01-01T00:00:00.000Z"),
      })),
    });

    const parsed = parsePracticeParams({
      bookId: BOOK_ID,
      chapter: 4,
      from: 1,
      to: 6,
      mode: "passage",
      size: "5",
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const started = await startPractice(ALICE_ID, parsed.range);
    if (!started.ok) throw new Error(started.error);

    const result = await getPracticeTasks(ALICE_ID, parsed.range);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toMatchObject({ verse: 1, verseEnd: 3, cardState: "review" });
    expect(result.tasks[1]).toMatchObject({ verse: 4, verseEnd: 6, cardState: "new" });
  });
});
