import { prisma } from "@/lib/prisma";
import { INITIAL_STABILITY, INITIAL_DIFFICULTY } from "@/lib/fsrs";

export async function getCardById(cardId: number, userId: number) {
  return prisma.card.findFirst({ where: { id: cardId, userId } });
}

export async function getCardsForVerse(verseId: number, userId: number) {
  return prisma.card.findMany({
    where: { verseId, userId },
    orderBy: { id: "asc" },
  });
}

export async function getDueCards(userId: number, limit?: number) {
  return prisma.card.findMany({
    where: { userId, due: { lte: new Date() } },
    orderBy: [{ stability: "asc" }, { due: "asc" }],
    take: limit ?? 30, // 单次复习上限，防止整本书全量加载
    include: { verse: true },
  });
}

export async function getCardProgress(bookId: number, userId: number) {
  const cards = await prisma.card.findMany({
    where: { userId, verse: { bookId } },
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
  userId: number,
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
  return prisma.card.updateMany({ where: { id: cardId, userId }, data }).then(
    (r) => (r.count > 0 ? prisma.card.findUnique({ where: { id: cardId } }) : null)
  );
}

export async function createCard(userId: number, verseId: number) {
  return prisma.card.create({
    data: {
      userId,
      verseId,
      stability: INITIAL_STABILITY,
      difficulty: INITIAL_DIFFICULTY,
    },
  });
}

export async function createCards(userId: number, verseIds: number[]) {
  return prisma.card.createMany({
    data: verseIds.map((verseId) => ({
      userId,
      verseId,
      stability: INITIAL_STABILITY,
      difficulty: INITIAL_DIFFICULTY,
    })),
  });
}

export async function deleteCardsByBook(bookId: number, userId: number) {
  return prisma.card.deleteMany({
    where: { userId, verse: { bookId } },
  });
}

export async function getAllCards(userId: number) {
  return prisma.card.findMany({
    where: { userId },
    include: { verse: { select: { bookId: true, chapter: true, verse: true } } },
    orderBy: { id: "asc" },
  });
}

export async function deleteAllCards(userId: number) {
  return prisma.card.deleteMany({ where: { userId } });
}
