import { prisma } from "@/lib/prisma";

export async function getNotesByVerse(verseId: number) {
  return prisma.note.findMany({
    where: { verseId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllNotes() {
  return prisma.note.findMany({
    include: { verse: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(verseId: number, content: string) {
  return prisma.note.create({ data: { verseId, content } });
}

export async function deleteNote(noteId: number) {
  return prisma.note.delete({ where: { id: noteId } });
}

export async function updateNote(noteId: number, content: string) {
  return prisma.note.update({
    where: { id: noteId },
    data: { content },
  });
}

export async function deleteAllNotes() {
  return prisma.note.deleteMany();
}
