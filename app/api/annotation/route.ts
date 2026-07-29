import { NextResponse } from "next/server";
import * as verseDb from "@/db/verse";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const verseId = searchParams.get("verseId");
    if (!verseId) {
      return NextResponse.json({ error: "缺少 verseId" }, { status: 400 });
    }
    const annotation = await verseDb.getVerseAnnotations(parseInt(verseId));
    return NextResponse.json({ annotation });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "获取注解失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
