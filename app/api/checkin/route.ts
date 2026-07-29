import { NextResponse } from "next/server";
import * as checkinService from "@/services/checkin";
import * as checkinDb from "@/db/checkin";

export async function GET() {
  try {
    const status = await checkinService.getCheckinStatus();
    const history = await checkinDb.getAllCheckins();
    return NextResponse.json({ ...status, history });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取签到失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const checkin = await checkinService.doCheckin();
    const streak = await checkinDb.getCheckinStreak();
    return NextResponse.json({ checkin, streak });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "签到失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
