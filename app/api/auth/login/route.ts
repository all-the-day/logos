import { NextResponse } from "next/server";
import * as userDb from "@/db/user";
import { verifyPassword, createSession } from "@/lib/auth";
import { cookies } from "next/headers";

const COOKIE_NAME = "logos_session";

// POST /api/auth/login — 账号+密码登录，设置 session cookie
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { username, password } = JSON.parse(text);
    if (!username || !password) {
      return NextResponse.json({ error: "请输入账号和密码" }, { status: 400 });
    }

    const user = await userDb.findByUsername(username.trim());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
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
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
