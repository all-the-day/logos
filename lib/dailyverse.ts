/**
 * 每日随机经节 — 基于日期种子，同一天返回同一节
 */
import { prisma } from "@/lib/prisma";
import { getTodayString } from "@/lib/date";

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickBySeed<T>(arr: T[], seed: number): T | null {
  if (arr.length === 0) return null;
  return arr[seed % arr.length];
}

export interface DailyVerse {
  book: string;
  chapter: number;
  section: number;
  content: string;
  kjv: string;
  reference: string;
}

export async function getDailyVerse(
  date?: string
): Promise<DailyVerse | null> {
  const dateStr = date || getTodayString();

  const books = await prisma.book.findMany({ orderBy: { id: "asc" } });
  if (books.length === 0) return null;

  const bookSeed = hashStr("book-" + dateStr);
  const book = pickBySeed(books, bookSeed);
  if (!book) return null;

  const verses = await prisma.verse.findMany({
    where: { bookId: book.id },
    orderBy: [{ chapter: "asc" }, { verse: "asc" }],
  });
  if (verses.length === 0) return null;

  const verseSeed = hashStr(`v-${dateStr}-${book.id}`);
  const verse = pickBySeed(verses, verseSeed);
  if (!verse) return null;

  return {
    book: book.name,
    chapter: verse.chapter,
    section: verse.verse,
    content: verse.content,
    kjv: verse.kjv || "",
    reference: `${book.name} ${verse.chapter}:${verse.verse}`,
  };
}
