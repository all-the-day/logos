import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAsrProvider, AsrError } from "@/lib/asr";
import { buildHotwordWords } from "@/lib/asr/hotwords";
import { checkRateLimit } from "@/lib/asr/rate-limit";
import { parseWav } from "@/lib/asr/wav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024; // 腾讯云一句话识别上限 3MB
const MAX_SECONDS = 60;
const MAX_REQUESTS_PER_MINUTE = 10;

function fail(status: number, error: string, retryAfterSec?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return NextResponse.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return fail(401, "请先登录");

  const limit = checkRateLimit(user.id, Date.now(), MAX_REQUESTS_PER_MINUTE);
  if (!limit.allowed) {
    return fail(429, "请求太频繁，请稍后再试", limit.retryAfterSec);
  }

  const provider = getAsrProvider();
  if (!provider) return fail(503, "语音识别未配置");

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES + 64 * 1024) {
    return fail(413, "音频文件过大");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "请求格式不正确");
  }

  const audio = form.get("audio");
  const verseId = Number(form.get("verseId"));

  if (!(audio instanceof File) || !Number.isInteger(verseId) || verseId <= 0) {
    return fail(400, "缺少音频或经节信息");
  }
  if (audio.size > MAX_BYTES) {
    return fail(413, "音频文件过大");
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  const wav = parseWav(bytes);
  if (!wav.ok) {
    return fail(400, wav.reason);
  }
  if (wav.info.durationSec > MAX_SECONDS) {
    return fail(400, "录音超过 60 秒");
  }

  const verse = await prisma.verse.findUnique({
    where: { id: verseId },
    include: { book: true },
  });
  if (!verse) return fail(404, "经节不存在");

  try {
    const result = await provider.transcribe({
      audio: Buffer.from(bytes),
      mime: "audio/wav",
      language: "zh",
      hotwords: buildHotwordWords(verse.book.name),
      referenceText: verse.content,
    });

    return NextResponse.json(
      {
        text: result.text,
        provider: result.provider,
        durationSec: Number(wav.info.durationSec.toFixed(2)),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AsrError) {
      if (error.code === "not_configured") return fail(503, "语音识别未配置");
      if (error.code === "invalid_audio") return fail(400, error.message);
      return fail(502, error.message);
    }
    return fail(500, "语音识别失败，请改用手动输入");
  }
}
