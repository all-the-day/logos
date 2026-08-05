import { prisma } from "@/lib/prisma";

export async function getNotesByVerse(verseId: number, userId: number) {
  return prisma.note.findMany({
    where: { verseId, userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllNotes(userId: number) {
  return prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(userId: number, verseId: number, content: string) {
  return prisma.note.create({ data: { userId, verseId, content } });
}

export async function deleteNote(noteId: number, userId: number) {
  return prisma.note.deleteMany({ where: { id: noteId, userId } });
}

export async function updateNote(noteId: number, userId: number, content: string) {
  return prisma.note.updateMany({ where: { id: noteId, userId }, data: { content } });
}

export async function deleteAllNotes(userId: number) {
  return prisma.note.deleteMany({ where: { userId } });
}
