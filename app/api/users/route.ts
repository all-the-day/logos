import { NextResponse } from "next/server";
import * as userDb from "@/db/user";
import { requireAdmin } from "@/lib/auth";

// GET /api/users — 仅管理员查看用户列表
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  try {
    const users = await userDb.findAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取用户列表失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
