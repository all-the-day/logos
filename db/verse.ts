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

export async function getVerseAnnotations(verseId: number) {
  return prisma.annotation.findUnique({ where: { verseId } });
}
