import { prisma } from "@/lib/prisma";
import type { BookInfo, VerseData } from "@/types";

export async function getAllBooks(): Promise<BookInfo[]> {
  return prisma.book.findMany({ orderBy: { id: "asc" } });
}

export async function getBookById(bookId: number) {
  return prisma.book.findUnique({ where: { id: bookId } });
}

export async function getVerseById(verseId: number): Promise<VerseData | null> {
  return prisma.verse.findUnique({ where: { id: verseId } });
}

export async function getVersesByBook(
  bookId: number,
  chapter?: number
): Promise<VerseData[]> {
  return prisma.verse.findMany({
    where: { bookId, ...(chapter ? { chapter } : {}) },
    orderBy: [{ chapter: "asc" }, { verse: "asc" }],
  });
}

export async function getVerseCount(bookId: number): Promise<number> {
  return prisma.verse.count({ where: { bookId } });
}

/**
 * 某章的节号列表（升序）——自由练习用来确定合法节号范围。
 * 排除 verse = 0：恢复本诗篇等的篇首标题以 section 0 入库（"大卫逃避…作的诗"），
 * 不属于可背正文，练习一律从第 1 节开始。
 */
export async function getChapterVerseNumbers(
  bookId: number,
  chapter: number
): Promise<Array<{ verse: number }>> {
  return prisma.verse.findMany({
    where: { bookId, chapter, verse: { gte: 1 } },
    select: { verse: true },
    orderBy: { verse: "asc" },
  });
}

/** 某章指定节号区间的经文（升序） */
export async function getVersesInRange(
  bookId: number,
  chapter: number,
  from: number,
  to: number
): Promise<VerseData[]> {
  return prisma.verse.findMany({
    where: { bookId, chapter, verse: { gte: from, lte: to } },
    orderBy: { verse: "asc" },
  });
}

export async function getVerseAnnotations(verseId: number) {
  return prisma.annotation.findUnique({ where: { verseId } });
}
