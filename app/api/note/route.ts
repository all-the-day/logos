import { NextResponse } from "next/server";
import * as noteDb from "@/db/note";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const verseId = searchParams.get("verseId");

    if (verseId) {
      const notes = await noteDb.getNotesByVerse(parseInt(verseId));
      return NextResponse.json({ notes });
    }

    const notes = await noteDb.getAllNotes();
    return NextResponse.json({ notes });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { verseId, content } = JSON.parse(text);
    if (!verseId || !content) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const note = await noteDb.createNote(verseId, content);
    return NextResponse.json({ note });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    await noteDb.deleteNote(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "删除笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { id, content } = JSON.parse(text);
    if (!id || !content) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const note = await noteDb.updateNote(id, content);
    return NextResponse.json({ note });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新笔记失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
