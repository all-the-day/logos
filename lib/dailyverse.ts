/**
 * 每日随机经节 — 基于日期+时间戳，同一天返回同一节
 * 不同月份/年份确保分布均匀
 */
import { prisma } from "@/lib/prisma";
import { getTodayString } from "@/lib/date";

function hashStr(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
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
  const [year, month, day] = dateStr.split("-");

  const books = await prisma.book.findMany({ orderBy: { id: "asc" } });
  if (books.length === 0) return null;

  // Use year+month+day as seed for more variation across dates
  const bookSeed = hashStr(`book-${year}-${month}-${day}`);
  const book = books[bookSeed % books.length];
  if (!book) return null;

  const verses = await prisma.verse.findMany({
    where: { bookId: book.id },
    orderBy: [{ chapter: "asc" }, { verse: "asc" }],
  });
  if (verses.length === 0) return null;

  // Seed by verse text content hash for better distribution within the book
  const verseSeed = hashStr(`v-${year}-${month}-${day}-${book.id}`);
  const verse = verses[verseSeed % verses.length];
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
