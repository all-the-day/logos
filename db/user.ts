import { prisma } from "@/lib/prisma";

export async function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(email: string, name: string, passwordHash: string, role = "user") {
  return prisma.user.create({ data: { email, name, passwordHash, role } });
}

export async function findAllUsers() {
  return prisma.user.findMany({
    orderBy: { id: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}
