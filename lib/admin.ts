/**
 * 管理操作 PIN 校验
 * 保护破坏性接口（删除计划 / 清除数据），防止公网随意调用
 */

export function verifyAdminPin(pin: unknown): boolean {
  if (typeof pin !== "string") return false;
  const expected = process.env.ADMIN_PIN;
  if (!expected) return false; // 未配置则禁止管理操作
  return pin === expected;
}
