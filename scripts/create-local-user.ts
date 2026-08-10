/**
 * 一次性本地脚本：往 dev.db 插入测试账号（用法与 seed.ts 相同）
 *   npx tsx scripts/create-local-user.ts [username] [name] [password] [role]
 * 默认：admin / 阿布 / admin123 / admin
 */
import { prisma } from "../lib/prisma";
import { randomBytes, scryptSync } from "crypto";

const [username, name, password, role] = [
  process.argv[2] || "admin",
  process.argv[3] || "阿布",
  process.argv[4] || "admin123",
  process.argv[5] || "admin",
];

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64, { N: 16384 }) as Buffer;
const passwordHash = `scrypt$${salt}$${hash.toString("hex")}`;

async function main() {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name, role, passwordHash },
    });
    console.log(
      `已重置密码: id=${user.id} username=${user.username} name=${user.name} role=${user.role} password=${password}`
    );
    return;
  }
  const user = await prisma.user.create({
    data: { username, name, passwordHash, role },
  });
  console.log(
    `创建成功: id=${user.id} username=${user.username} name=${user.name} role=${user.role} password=${password}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
