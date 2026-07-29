import { prisma } from "@/lib/prisma";

export async function getActivePlan() {
  return prisma.plan.findFirst({ where: { status: "active" } });
}

export async function createPlan(bookId: number, versesPerDay: number) {
  return prisma.plan.create({ data: { bookId, versesPerDay } });
}

export async function deletePlan(planId: number) {
  return prisma.plan.update({
    where: { id: planId },
    data: { status: "deleted" },
  });
}

export async function deleteAllPlans() {
  return prisma.plan.deleteMany();
}
