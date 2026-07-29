"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RATING } from "@/lib/fsrs";
import { generateFillBlanks } from "@/lib/compare";
import type { DiffSegment } from "@/lib/compare";
import type { Rating } from "@/lib/fsrs";

// ─── Shared types ─────────────────────────────────────────

export interface VerseRef {
  chapter: number;
  verse: number;
  content: string;
  kjv: string | null;
}

// ─── VerseViewer ───────────────────────────────────────────
export function VerseViewer({
  verse,
  showKJV,
  onStart,
  showFillOption,
}: {
  verse: VerseRef;
  showKJV: boolean;
  onStart: () => void;
  showFillOption?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <p className="text-xl leading-relaxed">{verse.content}</p>
        {showKJV && verse.kjv && (
          <p className="text-base text-muted-foreground italic">{verse.kjv}</p>
        )}
        {showFillOption && <p className="text-xs text-muted-foreground">提示：先切换模式再点开始背诵</p>}
        <Button className="w-full" onClick={onStart}>
          开始背诵
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── VerseReciter ──────────────────────────────────────────
export function VerseReciter({
  verse,
  fillMode,
  fillInputs,
  setFillInputs,
  userInput,
  setUserInput,
  inputRef,
  onSubmit,
  onViewOriginal,
}: {
  verse: VerseRef;
  fillMode: boolean;
  fillInputs: string[];
  setFillInputs: (v: string[]) => void;
  userInput: string;
  setUserInput: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: () => void;
  onViewOriginal?: () => void;
}) {
  if (fillMode) {
    const blanks = generateFillBlanks(verse.content);
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-lg leading-relaxed">{blanks.display}</p>
          <div className="space-y-2">
            {blanks.blanks.map((_, i) => (
              <input
                key={i}
                type="text"
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder={`填空 ${i + 1}`}
                value={fillInputs[i] || ""}
                onChange={(e) => {
                  const next = [...fillInputs];
                  next[i] = e.target.value;
                  setFillInputs(next);
                }}
              />
            ))}
          </div>
          <Button className="w-full" onClick={onSubmit}>
            提交
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <textarea
          ref={inputRef}
          className="w-full min-h-32 px-3 py-2 border rounded-md bg-background text-lg resize-none"
          placeholder="在此输入经文..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onSubmit}>
            提交 (Enter)
          </Button>
          {onViewOriginal && (
            <Button variant="outline" size="sm" onClick={onViewOriginal}>
              查看原文
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── VerseResult ───────────────────────────────────────────
export function VerseResult({
  verse,
  segments,
  accuracy,
  ratingDone,
  onRate,
  onNext,
  nextLabel,
}: {
  verse: VerseRef;
  segments: DiffSegment[];
  accuracy: number;
  ratingDone: boolean;
  onRate: (r: Rating) => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            原文
            <span className="text-sm font-normal text-muted-foreground">
              准确率 {(accuracy * 100).toFixed(0)}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg leading-relaxed">{verse.content}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>比对结果</CardTitle></CardHeader>
        <CardContent>
          <div className="text-lg leading-relaxed">
            {segments.map((seg, i) => {
              switch (seg.tag) {
                case "correct":
                  return <span key={i} className="text-green-600">{seg.text}</span>;
                case "wrong":
                  return <span key={i} className="text-red-500 line-through">{seg.original}</span>;
                case "missing":
                  return <span key={i} className="text-orange-400 bg-orange-50 px-0.5">{seg.text}</span>;
                case "extra":
                  return <span key={i} className="text-red-400 bg-red-50 px-0.5">{seg.text}</span>;
              }
            })}
          </div>
        </CardContent>
      </Card>

      {!ratingDone && (
        <Card>
          <CardHeader><CardTitle>评分</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {([RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY] as Rating[]).map((r) => {
                const labels: Record<number, string> = { 1: "忘记", 2: "困难", 3: "正确", 4: "容易" };
                return (
                  <Button key={r} variant={r === RATING.GOOD ? "default" : "outline"}
                    onClick={() => onRate(r)} className="flex-col py-4 h-auto">
                    <span>{labels[r]}</span>
                    <span className="text-xs text-muted-foreground mt-1">{r}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              按 1-4 评分 · 空格跳过
            </p>
          </CardContent>
        </Card>
      )}

      {ratingDone && (
        <Button className="w-full" onClick={onNext}>
          {nextLabel || "下一节"}
        </Button>
      )}
    </div>
  );
}
