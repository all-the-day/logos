import { NextResponse } from "next/server";
import * as feedbackDb from "@/db/feedback";

export async function GET() {
  try {
    const feedback = await feedbackDb.getAllFeedback();
    return NextResponse.json({ feedback });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取反馈失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { type, content } = JSON.parse(text);
    if (!type || !content) {
      return NextResponse.json({ error: "缺少 type 或 content" }, { status: 400 });
    }
    if (!["bug", "suggestion", "other"].includes(type)) {
      return NextResponse.json({ error: "无效类型" }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: "内容过长（最多 2000 字）" }, { status: 400 });
    }

    const feedback = await feedbackDb.createFeedback(type, content);
    return NextResponse.json({ feedback });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "提交反馈失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { id, status } = JSON.parse(text);
    if (!id || !["open", "resolved"].includes(status)) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const feedback = await feedbackDb.updateFeedbackStatus(Number(id), status);
    return NextResponse.json({ feedback });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新反馈失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
