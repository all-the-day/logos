// tools/feedback/lib.ts — 共享：加载 .env.local + 线上登录
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const API_BASE = process.env.LOGO_API_BASE ?? "https://logos.duoban.xyz";

/** 从项目根 .env.local 加载凭据（不存在则忽略，允许纯环境变量方式） */
export function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.replace(/\r$/, ""); // 兼容 CRLF 行尾（Windows）
      const m = trimmed.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch {
    // .env.local 不存在 — 由环境变量提供
  }
}

/** 管理员登录，返回 session cookie 字符串 */
export async function login(): Promise<string> {
  const username = process.env.LOGO_ADMIN_USER;
  const password = process.env.LOGO_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("缺少凭据：请在 .env.local 配置 LOGO_ADMIN_USER / LOGO_ADMIN_PASSWORD");
  }
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`登录失败 ${res.status}: ${await res.text()}`);
  const cookies = res.headers.getSetCookie?.() ?? [];
  const session = cookies.map((c) => c.split(";")[0]).find((c) => c.startsWith("logos_session="));
  if (!session) throw new Error("登录响应缺少 session cookie");
  return session;
}

export interface Feedback {
  id: number;
  type: string;
  content: string;
  status: string;
  createdAt: string;
  user?: { username: string; name: string } | null;
}
