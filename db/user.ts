import { prisma } from "@/lib/prisma";

export async function findByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

export async function findById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(username: string, name: string, passwordHash: string, role = "user") {
  return prisma.user.create({ data: { username, name, passwordHash, role } });
}

export async function findAllUsers() {
  return prisma.user.findMany({
    orderBy: { id: "asc" },
    select: { id: true, username: true, name: true, role: true, createdAt: true },
  });
}
