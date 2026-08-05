/**
 * 认证工具 — scrypt 密码哈希 + session cookie
 */
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import * as sessionDb from "@/db/session";
import * as userDb from "@/db/user";

const COOKIE_NAME = "logos_session";
const SESSION_DAYS = 30;

// ── 密码哈希（scrypt，零依赖）──────────────────────
const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: SCRYPT_N }) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const hash = scryptSync(password, salt, 64, { N: SCRYPT_N }) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// ── Session 管理 ──────────────────────────────────

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await sessionDb.createSession(token, userId, expiresAt);
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await sessionDb.deleteSession(token);
    store.delete(COOKIE_NAME);
  }
}

// ── 当前用户 ──────────────────────────────────────

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await sessionDb.findSessionByToken(token);
  if (!session || !session.user) return null;
  if (session.expiresAt < new Date()) {
    await sessionDb.deleteSession(token);
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

/** 需要登录 — 未登录返回 null（调用方决定 401 或 redirect） */
export async function requireUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}

/** 需要管理员 — 非 admin 返回 null */
export async function requireAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
