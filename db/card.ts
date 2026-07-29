import { prisma } from "@/lib/prisma";

export async function getCardById(cardId: number) {
  return prisma.card.findUnique({ where: { id: cardId } });
}

export async function getCardsForVerse(verseId: number) {
  return prisma.card.findMany({ where: { verseId } });
}

export async function getDueCards(limit?: number) {
  return prisma.card.findMany({
    where: { due: { lte: new Date() } },
    orderBy: { stability: "asc" },
    ...(limit ? { take: limit } : {}),
    include: { verse: true },
  });
}

export async function getCardProgress(bookId: number) {
  const cards = await prisma.card.findMany({
    where: { verse: { bookId } },
  });
  const mastered = cards.filter(
    (c) => c.state === "review" && c.stability >= 21
  ).length;
  const learning = cards.filter(
    (c) => c.state !== "new" && c.stability < 21
  ).length;
  const newCards = cards.filter((c) => c.state === "new").length;
  return { total: cards.length, mastered, learning, new: newCards };
}

export async function updateCard(
  cardId: number,
  data: {
    stability?: number;
    difficulty?: number;
    reps?: number;
    lapses?: number;
    state?: string;
    lastReview?: Date | null;
    due?: Date;
  }
) {
  return prisma.card.update({ where: { id: cardId }, data });
}

export async function createCard(verseId: number) {
  return prisma.card.create({ data: { verseId } });
}

export async function createCards(verseIds: number[]) {
  return prisma.card.createMany({
    data: verseIds.map((verseId) => ({ verseId })),
  });
}

export async function deleteCardsByBook(bookId: number) {
  return prisma.card.deleteMany({
    where: { verse: { bookId } },
  });
}

export async function getAllCards() {
  return prisma.card.findMany({
    include: { verse: { select: { bookId: true, chapter: true, verse: true } } },
    orderBy: { id: "asc" },
  });
}

export async function deleteAllCards() {
  return prisma.card.deleteMany();
}
