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

/** admin：查全部反馈，附带提交人信息 */
export async function getAllFeedbackForAdmin() {
  return prisma.feedback.findMany({
    include: { user: { select: { username: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** admin：更新任意反馈状态（不限制 userId） */
export async function updateFeedbackStatusAdmin(id: number, status: string) {
  return prisma.feedback.updateMany({ where: { id }, data: { status } });
}
