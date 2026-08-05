import { NextResponse } from "next/server";
import * as noteDb from "@/db/note";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const verseId = searchParams.get("verseId");

    if (verseId) {
      const notes = await noteDb.getNotesByVerse(parseInt(verseId), user.id);
      return NextResponse.json({ notes });
    }

    const notes = await noteDb.getAllNotes(user.id);
    return NextResponse.json({ notes });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { verseId, content } = JSON.parse(text);
    if (!verseId || !content) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const note = await noteDb.createNote(user.id, parseInt(verseId), content);
    return NextResponse.json({ note });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const result = await noteDb.deleteNote(parseInt(id), user.id);
    if (result.count === 0) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "删除笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { id, content } = JSON.parse(text);
    if (!id || !content) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const result = await noteDb.updateNote(parseInt(id), user.id, content);
    if (result.count === 0) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
