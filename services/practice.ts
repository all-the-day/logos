import * as verseDb from "@/db/verse";
import * as cardDb from "@/db/card";
import { ensureCardsForVerses } from "@/services/plan";
import { groupTasksByReciteMode, toTask } from "@/services/learn";
import { MAX_PRACTICE_VERSES, type PracticeParsed } from "@/lib/practice";
import type { PracticeRange, TaskData } from "@/types";

export type PracticeError = { ok: false; status: number; error: string };
export type PracticeOk<T> = { ok: true } & T;

/** 某章可用的节号范围（用于设置表单提示与上限校验） */
export async function getChapterInfo(bookId: number, chapter: number) {
  const rows = await verseDb.getChapterVerseNumbers(bookId, chapter);
  if (rows.length === 0) return null;
  return {
    bookId,
    chapter,
    count: rows.length,
    firstVerse: rows[0].verse,
    lastVerse: rows[rows.length - 1].verse,
    /** 实际节号列表：节号可能不连续，客户端据此算真实节数 */
    verses: rows.map((r) => r.verse),
  };
}

/**
 * 按数据库校验节号范围并取出经文。
 * to 未指定时取本章末节；超出本章范围或超过节数上限返回错误。
 * 上限按实际取到的经节数判断（章节节号可能不连续）。
 */
async function resolveRange(parsed: PracticeParsed) {
  const info = await getChapterInfo(parsed.bookId, parsed.chapter);
  if (!info) {
    return { ok: false as const, status: 404, error: "没有找到该章的经文" };
  }

  const rangeLabel = `${info.firstVerse}-${info.lastVerse}`;
  if (parsed.from < info.firstVerse || parsed.from > info.lastVerse) {
    return { ok: false as const, status: 400, error: `起始节号超出本章范围（${rangeLabel}）` };
  }

  const to = parsed.to ?? info.lastVerse;
  if (to > info.lastVerse) {
    return { ok: false as const, status: 400, error: `结束节号超出本章范围（${rangeLabel}）` };
  }

  const verses = await verseDb.getVersesInRange(parsed.bookId, parsed.chapter, parsed.from, to);
  if (verses.length === 0) {
    return { ok: false as const, status: 404, error: "所选范围没有经文" };
  }
  if (verses.length > MAX_PRACTICE_VERSES) {
    return {
      ok: false as const,
      status: 400,
      error: `一次最多练习 ${MAX_PRACTICE_VERSES} 节，请缩小范围`,
    };
  }

  return { ok: true as const, verses, to };
}

/**
 * 开始自由练习：校验范围并为缺失的经节补建卡片（幂等）。
 * 写操作，必须经 API Route 调用。
 */
export async function startPractice(userId: number, parsed: PracticeParsed) {
  const resolved = await resolveRange(parsed);
  if (!resolved.ok) return resolved;

  const created = await ensureCardsForVerses(userId, resolved.verses.map((v) => v.id));

  return {
    ok: true as const,
    range: { ...parsed, to: resolved.to } as PracticeRange,
    count: resolved.verses.length,
    created,
  };
}

/**
 * 读取一次自由练习的队列（只读）。
 * 卡片缺失（例如清空数据后打开旧链接）时返回 409，由页面引导重新选择经节。
 */
export async function getPracticeTasks(
  userId: number,
  parsed: PracticeParsed
): Promise<PracticeOk<{ tasks: TaskData[]; range: PracticeRange }> | PracticeError> {
  const resolved = await resolveRange(parsed);
  if (!resolved.ok) return resolved;

  const cards = await cardDb.getCardsForVerses(userId, resolved.verses.map((v) => v.id));
  if (cards.length !== resolved.verses.length) {
    return { ok: false, status: 409, error: "练习数据已变化，请重新选择经节" };
  }

  return {
    ok: true,
    tasks: groupTasksByReciteMode(cards.map(toTask), parsed.mode, parsed.passageSize),
    range: { ...parsed, to: resolved.to } as PracticeRange,
  };
}
