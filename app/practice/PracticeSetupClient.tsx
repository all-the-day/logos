"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BookSelector from "@/components/BookSelector";
import { MAX_PRACTICE_VERSES } from "@/lib/practice";
import type { BookInfo } from "@/types";

interface ChapterInfo {
  count: number;
  firstVerse: number;
  lastVerse: number;
  /** 实际节号（可能不连续），用于精确计算所选范围的真实节数 */
  verses: number[];
}

interface Props {
  books: BookInfo[];
  /** 默认背诵方式：沿用当前计划的设置（无计划时单节） */
  defaultMode: "single" | "passage";
  defaultPassageSize: number;
  defaultBookId: number | null;
  /** 链接参数校验失败时回填用户刚才的选择 */
  initial?: {
    bookId?: number;
    chapter?: number;
    from?: number;
    to?: number;
    mode?: "single" | "passage";
    size?: number;
  };
  error?: string | null;
}

export default function PracticeSetupClient({
  books,
  defaultMode,
  defaultPassageSize,
  defaultBookId,
  initial,
  error,
}: Props) {
  const router = useRouter();
  const [bookId, setBookId] = useState<number | null>(initial?.bookId ?? defaultBookId ?? null);
  const [chapter, setChapter] = useState<number>(initial?.chapter ?? 1);
  const [from, setFrom] = useState<number | "">(initial?.from ?? 1);
  const [to, setTo] = useState<number | "">(initial?.to ?? "");
  const [mode, setMode] = useState<"single" | "passage">(initial?.mode ?? defaultMode);
  const [passageSize, setPassageSize] = useState(initial?.size ?? defaultPassageSize);
  const [info, setInfo] = useState<ChapterInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(error ?? null);

  const book = books.find((b) => b.id === bookId) ?? null;
  const chapterCount = Math.max(1, book?.chapters ?? 1);

  const handleSelectBook = useCallback((id: number) => {
    setBookId(id);
    setChapter(1);
  }, []);

  // 选中书卷/章后取本章节号范围，用于展示"共 N 节"并约束输入
  useEffect(() => {
    if (!bookId) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoadingInfo(true);
    fetch(`/api/practice?bookId=${bookId}&chapter=${chapter}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const chapterInfo: ChapterInfo | null = data?.chapter ?? null;
        setInfo(chapterInfo);
        // 换书卷/章后把越界的节号收敛到本章范围，避免用户点了才报错
        if (chapterInfo) {
          const clamp = (value: number | "") =>
            value === ""
              ? ""
              : Math.max(
                  chapterInfo.firstVerse,
                  Math.min(Number(value), chapterInfo.lastVerse)
                );
          setFrom((prev) => (prev === "" ? chapterInfo.firstVerse : clamp(prev)));
          setTo((prev) => (prev === "" ? "" : clamp(prev)));
        }
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingInfo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, chapter]);

  const handleWholeChapter = useCallback(() => {
    setFrom(info?.firstVerse ?? 1);
    setTo(info?.lastVerse ?? "");
  }, [info]);

  const handleStart = useCallback(async () => {
    if (!bookId || from === "") return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          chapter,
          from,
          to: to === "" ? undefined : to,
          mode,
          passageSize: mode === "passage" ? passageSize : 5,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.range) {
        setErrorMsg(data?.error || `无法开始练习 (${res.status})`);
        return;
      }
      const params = new URLSearchParams({
        bookId: String(data.range.bookId),
        chapter: String(data.range.chapter),
        from: String(data.range.from),
        to: String(data.range.to),
      });
      if (data.range.mode === "passage") {
        params.set("mode", "passage");
        params.set("size", String(data.range.passageSize));
      }
      router.push(`/practice?${params.toString()}`);
    } catch (e) {
      setErrorMsg(`网络错误：${e instanceof Error ? e.message : "无法连接服务器"}`);
    } finally {
      setSubmitting(false);
    }
  }, [bookId, chapter, from, to, mode, passageSize, router]);

  const rangeInvalid =
    from === "" ||
    Number(from) < 1 ||
    (to !== "" && (Number(to) < Number(from) || Number(to) < 1));

  // 节数上限：按本章实际节号计算（节号可能不连续），info 未就绪时由服务端兜底校验
  const selectedCount =
    from === "" || !bookId
      ? 0
      : info
        ? info.verses.filter((v) => v >= Number(from) && (to === "" || v <= Number(to))).length
        : 0;
  const tooMany = selectedCount > MAX_PRACTICE_VERSES;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">自由练习</h2>
        <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground">
          返回计划
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>选择要背的经节</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">选择书卷</label>
            <BookSelector books={books} selectedId={bookId} onSelect={handleSelectBook} />
          </div>

          <div>
            <label htmlFor="practice-chapter" className="text-sm font-medium mb-2 block">章</label>
            <select
              id="practice-chapter"
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={chapter}
              onChange={(e) => setChapter(Number(e.target.value))}
              disabled={!book}
            >
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>
                  第 {c} 章
                </option>
              ))}
            </select>
            {book && (
              <p className="text-xs text-muted-foreground mt-1">
                {loadingInfo
                  ? "正在读取本章经节..."
                  : info
                    ? `本章共 ${info.count} 节（${info.firstVerse}-${info.lastVerse}）`
                    : "该章暂无经文"}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">节范围</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={from}
                onChange={(e) => setFrom(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-20 px-3 py-2 border rounded-md bg-background text-sm"
                aria-label="起始节"
              />
              <span className="text-sm text-muted-foreground">至</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={to}
                onChange={(e) => setTo(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-20 px-3 py-2 border rounded-md bg-background text-sm"
                aria-label="结束节"
                placeholder="章末"
              />
              <Button variant="outline" size="sm" onClick={handleWholeChapter} disabled={!info}>
                整章
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              「至」留空表示到本章最后一节；一次最多 50 节。
            </p>
          </div>

          <div>
            <span className="text-sm font-medium mb-2 block">背诵方式</span>
            <div className="flex gap-2">
              <Button
                variant={mode === "single" ? "default" : "outline"}
                size="sm"
                aria-pressed={mode === "single"}
                onClick={() => setMode("single")}
              >
                单节精背
              </Button>
              <Button
                variant={mode === "passage" ? "default" : "outline"}
                size="sm"
                aria-pressed={mode === "passage"}
                onClick={() => setMode("passage")}
              >
                连背多节
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              单节：一节一次评分；连背：按组默背，整组一次比对与评分。
            </p>
          </div>

          {mode === "passage" && (
            <div>
              <span className="text-sm font-medium mb-2 block">每组节数</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="减少每组节数"
                  onClick={() => setPassageSize(Math.max(2, passageSize - 1))}
                >
                  -
                </Button>
                <span className="w-12 text-center font-medium">{passageSize}</span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="增加每组节数"
                  onClick={() => setPassageSize(Math.min(10, passageSize + 1))}
                >
                  +
                </Button>
                <span className="text-sm text-muted-foreground ml-2">节/组</span>
              </div>
            </div>
          )}

          {book && from !== "" && (
            <div className="text-sm text-muted-foreground p-3 bg-secondary rounded-lg">
              {book.name} {chapter}:{from}
              {to !== "" ? `-${to}` : " 至章末"}
              {selectedCount > 0 && ` · 共 ${selectedCount} 节`}
            </div>
          )}

          {tooMany && (
            <p className="text-sm text-red-600">
              一次最多练习 {MAX_PRACTICE_VERSES} 节，请缩小节范围。
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            自由练习的评分同样计入 FSRS 复习安排；首次学习的新经节会计入当天的每日新卡配额。
          </p>

          <Button
            className="w-full"
            size="lg"
            disabled={!bookId || rangeInvalid || tooMany || submitting || (!loadingInfo && !info)}
            onClick={handleStart}
          >
            {submitting ? "准备中..." : "开始练习"}
          </Button>
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
