import { prisma } from "@/lib/prisma";

export async function createFeedback(type: string, content: string) {
  return prisma.feedback.create({ data: { type, content } });
}

export async function getAllFeedback() {
  return prisma.feedback.findMany({ orderBy: { createdAt: "desc" } });
}

export async function updateFeedbackStatus(id: number, status: string) {
  return prisma.feedback.update({ where: { id }, data: { status } });
}
