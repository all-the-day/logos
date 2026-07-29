"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { compareVerse, generateFillBlanks } from "@/lib/compare";
import { VerseViewer, VerseReciter, VerseResult } from "@/components/VerseStudy";
import type { Rating } from "@/lib/fsrs";
import type { PlanInfo } from "@/types";

interface Task {
  id: number;
  bookId: number;
  chapter: number;
  verse: number;
  content: string;
  kjv: string | null;
}

interface Props {
  plan: PlanInfo | null;
  tasks: Task[];
}

type Mode = "view" | "recite" | "result";

export default function LearnClient({ plan, tasks }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("view");
  const [userInput, setUserInput] = useState("");
  const [segments, setSegments] = useState<import("@/lib/compare").DiffSegment[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [showKJV, setShowKJV] = useState(false);
  const [fillMode, setFillMode] = useState(false);
  const [fillInputs, setFillInputs] = useState<string[]>([]);
  const [ratingDone, setRatingDone] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const undoCardRef = useRef<{
    id: number;
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    state: string;
    lastReview: Date | string | null;
    due: Date | string;
  } | null>(null);

  const task = tasks[currentIdx];
  const totalTasks = tasks.length;

  // Group tasks by chapter for quick navigation
  const chapterGroups = tasks.reduce((acc, t, idx) => {
    const ch = t.chapter;
    if (!acc.get(ch)) acc.set(ch, { chapter: ch, firstIdx: idx, count: 0 });
    acc.get(ch)!.count++;
    return acc;
  }, new Map<number, { chapter: number; firstIdx: number; count: number }>());
  const chapters = Array.from(chapterGroups.values());

  const handleStartRecite = useCallback(() => {
    setUserInput("");
    setSegments([]);
    setAccuracy(0);
    setRatingDone(false);
    setShowOriginal(false);
    if (fillMode) {
      const blanks = generateFillBlanks(task.content);
      setFillInputs(new Array(blanks.blanks.length).fill(""));
    }
    setMode("recite");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [task, fillMode]);

  const handleSubmit = useCallback(() => {
    let finalInput = userInput;
    if (fillMode) {
      finalInput = fillInputs.join(" ");
    }
    const result = compareVerse(finalInput, task.content);
    setSegments(result.segments);
    setAccuracy(result.accuracy);
    setMode("result");
  }, [userInput, fillInputs, fillMode, task]);

  const handleRate = useCallback(
    async (rating: Rating) => {
      setRatingDone(true);
      setUndoAvailable(false);
      undoCardRef.current = null;
      try {
        // Save current card state for undo before rating
        const res = await fetch(`/api/card?verseId=${task.id}`);
        const data = await res.json();
        if (data.cards?.length > 0) {
          undoCardRef.current = data.cards[data.cards.length - 1];
        }
        await fetch("/api/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verseId: task.id,
            rating,
          }),
        });
        if (undoCardRef.current) setUndoAvailable(true);
      } catch { /* ignore */ }
    },
    [task]
  );

  const handleUndo = useCallback(async () => {
    const prev = undoCardRef.current;
    if (!prev) return;
    try {
      await fetch("/api/card", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: prev.id,
          stability: prev.stability,
          difficulty: prev.difficulty,
          reps: prev.reps,
          lapses: prev.lapses,
          state: prev.state,
          lastReview: prev.lastReview,
          due: prev.due,
        }),
      });
      setRatingDone(false);
      setUndoAvailable(false);
      undoCardRef.current = null;
    } catch { /* ignore */ }
  }, []);

  const handleNext = useCallback(() => {
    if (currentIdx < totalTasks - 1) {
      setCurrentIdx((i) => i + 1);
      setMode("view");
      setUserInput("");
      setSegments([]);
      setRatingDone(false);
    }
  }, [currentIdx, totalTasks]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (mode === "recite" && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (mode === "result" && !ratingDone) {
        if (e.key === "1") handleRate(1 as Rating);
        if (e.key === "2") handleRate(2 as Rating);
        if (e.key === "3") handleRate(3 as Rating);
        if (e.key === "4") handleRate(4 as Rating);
        if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          handleNext(); // skip without rating
        }
      }
      if (mode === "result" && ratingDone && undoAvailable && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, ratingDone, undoAvailable, handleSubmit, handleRate, handleNext, handleUndo]);

  if (!plan) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <p className="text-muted-foreground">请先创建学习计划。</p>
        <Link href="/plan" className={cn(buttonVariants({}), "mt-4")}>
          去创建
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center space-y-4">
        <p className="text-muted-foreground">今日任务已完成！</p>
        <Link href="/plan" className={buttonVariants({})}>返回</Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-muted-foreground">
          {task.chapter}:{task.verse}
        </h2>
        <div className="flex items-center gap-2">
          {task.kjv && (
            <Button variant="ghost" size="sm" onClick={() => setShowKJV(!showKJV)}>
              {showKJV ? "中" : "EN"}
            </Button>
          )}
          <Button variant="ghost" size="sm"
            onClick={() => setFillMode(!fillMode)}>
            {fillMode ? "全文" : "填空"}
          </Button>
          <Badge variant="outline">
            {currentIdx + 1}/{totalTasks}
          </Badge>
        </div>
      </div>

      {mode === "view" && (
        <>
          <VerseViewer
            verse={task}
            showKJV={showKJV}
            onStart={handleStartRecite}
            showFillOption
          />
          {/* Chapter quick nav */}
          {chapters.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">快速跳转</p>
              <div className="flex flex-wrap gap-1.5">
                {chapters.map((ch) => {
                  const isCurrent = ch.chapter === task.chapter;
                  return (
                    <button
                      key={ch.chapter}
                      onClick={() => setCurrentIdx(ch.firstIdx)}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-full border transition-colors",
                        isCurrent
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      {ch.chapter} ({ch.count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {mode === "recite" && (
        <>
          {showOriginal && (
            <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground">
              {task.content}
            </div>
          )}
          <VerseReciter
            verse={task}
            fillMode={fillMode}
            fillInputs={fillInputs}
            setFillInputs={setFillInputs}
            userInput={userInput}
            setUserInput={setUserInput}
            inputRef={inputRef}
            onSubmit={handleSubmit}
            onViewOriginal={() => setShowOriginal(!showOriginal)}
          />
        </>
      )}

      {mode === "result" && (
        <VerseResult
          verse={task}
          segments={segments}
          accuracy={accuracy}
          ratingDone={ratingDone}
          onRate={handleRate}
          onNext={handleNext}
          nextLabel={currentIdx >= totalTasks - 1 ? "完成" : "下一节"}
          verseId={task.id}
          onUndo={undoAvailable ? handleUndo : undefined}
        />
      )}
    </div>
  );
}
