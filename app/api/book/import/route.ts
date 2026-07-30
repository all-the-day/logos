import { NextResponse } from "next/server";
import { importBookIfNeeded, getAllBookList, isBookImported } from "@/lib/import-book";

export async function GET() {
  try {
    const all = getAllBookList();
    // Mark which are already imported
    const result = [];
    for (const b of all) {
      result.push({ ...b, imported: await isBookImported(b.id) });
    }
    return NextResponse.json({ books: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取书卷列表失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const { bookId } = JSON.parse(text);
    if (!bookId) {
      return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
    }

    const imported = await importBookIfNeeded(bookId);
    return NextResponse.json({ imported, bookId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导入书卷失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
