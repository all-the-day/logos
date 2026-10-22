import { NextResponse } from "next/server";
import * as practiceService from "@/services/practice";
import { parsePracticeParams } from "@/lib/practice";
import { requireUser } from "@/lib/auth";

/** 章节信息：某章共有几节、起止节号（自由练习表单用） */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parsePracticeParams({
      bookId: searchParams.get("bookId"),
      chapter: searchParams.get("chapter"),
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const info = await practiceService.getChapterInfo(
      parsed.range.bookId,
      parsed.range.chapter
    );
    if (!info) {
      return NextResponse.json({ error: "没有找到该章的经文" }, { status: 404 });
    }
    return NextResponse.json({ chapter: info });
  } catch (error) {
    console.error("获取章节信息失败", error);
    return NextResponse.json({ error: "获取章节信息失败" }, { status: 500 });
  }
}

/** 开始自由练习：校验范围 + 幂等补建卡片，返回规范化后的范围 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "请求参数格式不正确" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求参数不正确" }, { status: 400 });
    }

    const parsed = parsePracticeParams(body as Record<string, unknown>);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const result = await practiceService.startPractice(user.id, parsed.range);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      range: result.range,
      count: result.count,
      created: result.created,
    });
  } catch (error) {
    // 不把 Prisma/内部错误原文回传客户端
    console.error("开始自由练习失败", error);
    return NextResponse.json({ error: "开始练习失败，请稍后重试" }, { status: 500 });
  }
}
