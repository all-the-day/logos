import * as verseDb from "@/db/verse";

export async function getAvailableBooks() {
  return verseDb.getAllBooks();
}

export async function getBookVerses(bookId: number) {
  return verseDb.getVersesByBook(bookId);
}

export async function getVerseWithAnnotations(verseId: number) {
  const verse = await verseDb.getVerseById(verseId);
  const annotations = await verseDb.getVerseAnnotations(verseId);
  return { verse, annotations };
}
