import { NextResponse } from "next/server";
import * as userDb from "@/db/user";
import { hashPassword, requireAdmin } from "@/lib/auth";

// POST /api/auth/register — 仅管理员创建账号
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { email, name, password } = JSON.parse(text);

    if (!email || !name || !password) {
      return NextResponse.json({ error: "请填写邮箱、昵称和密码" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await userDb.findByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    const user = await userDb.createUser(normalizedEmail, name.trim(), hashPassword(password));
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建账号失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
