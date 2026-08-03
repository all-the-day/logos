import { NextResponse } from "next/server";
import { importBookIfNeeded, getAllBookList } from "@/lib/import-book";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const all = getAllBookList();
    // 已导入书卷 id 集合（一次查询）
    const importedBooks = await prisma.book.findMany({
      select: { id: true },
    });
    const importedIds = new Set(importedBooks.map((b) => b.id));

    const result = all.map((b) => ({ ...b, imported: importedIds.has(b.id) }));
    return NextResponse.json({ books: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取书卷列表失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let bookId: number | null = null;
  try {
    const text = await request.text();
    if (!text) return NextResponse.json({ error: "请求体为空" }, { status: 400 });
    const body = JSON.parse(text);
    bookId = body.bookId;
    if (!bookId) {
      return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
    }

    const imported = await importBookIfNeeded(bookId);
    return NextResponse.json({ imported, bookId });
  } catch (error: unknown) {
    // 并发导入同卷时唯一约束冲突，视为已导入而非错误
    const isUniqueConflict =
      error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
    if (isUniqueConflict) {
      return NextResponse.json({ imported: false, bookId, alreadyImported: true });
    }
    const msg = error instanceof Error ? error.message : "导入书卷失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
