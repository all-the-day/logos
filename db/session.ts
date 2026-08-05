import { prisma } from "@/lib/prisma";

export async function createSession(token: string, userId: number, expiresAt: Date) {
  return prisma.session.create({ data: { token, userId, expiresAt } });
}

export async function findSessionByToken(token: string) {
  return prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
}

export async function deleteSession(token: string) {
  return prisma.session.delete({ where: { token } }).catch(() => null);
}

export async function deleteUserSessions(userId: number) {
  return prisma.session.deleteMany({ where: { userId } });
}

export async function deleteExpiredSessions() {
  return prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
