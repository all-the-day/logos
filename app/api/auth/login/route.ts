import { NextResponse } from "next/server";
import * as userDb from "@/db/user";
import { hashPassword, verifyPassword, createSession, destroySession, getCurrentUser, requireAdmin } from "@/lib/auth";
import { cookies } from "next/headers";

const COOKIE_NAME = "logos_session";

// POST /api/auth/login — 邮箱+密码登录，设置 session cookie
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { email, password } = JSON.parse(text);
    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    const user = await userDb.findByEmail(email.toLowerCase().trim());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const token = await createSession(user.id);
    const store = await cookies();
    store.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 86400,
      path: "/",
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
