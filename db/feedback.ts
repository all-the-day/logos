import { prisma } from "@/lib/prisma";

export async function createFeedback(userId: number, type: string, content: string) {
  return prisma.feedback.create({ data: { userId, type, content } });
}

export async function getAllFeedback(userId: number) {
  return prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateFeedbackStatus(id: number, userId: number, status: string) {
  return prisma.feedback.updateMany({ where: { id, userId }, data: { status } });
}
