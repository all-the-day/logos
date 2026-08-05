import { NextResponse } from "next/server";
import * as checkinService from "@/services/checkin";
import * as checkinDb from "@/db/checkin";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const status = await checkinService.getCheckinStatus(user.id);
    const history = await checkinDb.getAllCheckins(user.id);
    return NextResponse.json({ ...status, history });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取签到失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const checkin = await checkinService.doCheckin(user.id);
    const streak = await checkinDb.getCheckinStreak(user.id);
    return NextResponse.json({ checkin, streak });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "签到失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
