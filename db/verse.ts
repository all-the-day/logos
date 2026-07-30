import { prisma } from "@/lib/prisma";
import type { BookInfo, VerseData } from "@/types";
import { getAllBookList } from "@/lib/import-book";

export async function getAllBooks(): Promise<BookInfo[]> {
  // 从 prisma 获取已导入的书卷
  const imported = await prisma.book.findMany({ orderBy: { id: "asc" } });
  const importedIds = new Set(imported.map((b) => b.id));

  // 从 bible.db 获取全本 66 卷列表，标记是否已导入
  try {
    const all = getAllBookList();
    return all
      .filter((b) => importedIds.has(b.id))
      .map((b) => ({ id: b.id, name: b.name, chapters: b.chapters }));
  } catch {
    // bible.db 不在时回退到只显示已导入的
    return imported;
  }
}

export async function getAllBooksWithImportStatus(): Promise<Array<BookInfo & { imported: boolean }>> {
  const imported = await prisma.book.findMany({ orderBy: { id: "asc" } });
  const importedIds = new Set(imported.map((b) => b.id));

  try {
    const all = getAllBookList();
    return all.map((b) => ({ id: b.id, name: b.name, chapters: b.chapters, imported: importedIds.has(b.id) }));
  } catch {
    return imported.map((b) => ({ ...b, imported: true }));
  }
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
