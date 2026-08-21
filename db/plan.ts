import { prisma } from "@/lib/prisma";

export async function getActivePlan(userId: number) {
  return prisma.plan.findFirst({ where: { userId, status: "active" } });
}

export async function createPlan(userId: number, bookId: number, versesPerDay: number) {
  return prisma.plan.create({ data: { userId, bookId, versesPerDay } });
}

export async function deletePlan(planId: number, userId: number) {
  return prisma.plan.update({
    where: { id: planId },
    data: { status: "deleted" },
  });
}

export async function updatePlan(
  planId: number,
  userId: number,
  data: { bookId?: number; versesPerDay?: number }
) {
  return prisma.plan.update({
    where: { id: planId },
    data,
  });
}

export async function deleteAllPlans(userId: number) {
  return prisma.plan.deleteMany({ where: { userId } });
}
