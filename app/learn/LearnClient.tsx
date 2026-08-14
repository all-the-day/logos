"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { compareVerse, generateFillBlanks, densityForStability } from "@/lib/compare";
import { VerseViewer, VerseReciter, VerseResult } from "@/components/VerseStudy";
import { recommendRating, type Rating } from "@/lib/fsrs";
import type { PlanInfo, TaskData } from "@/types";

interface Props {
  plan: PlanInfo | null;
  tasks: TaskData[];
}

type Mode = "view" | "recite" | "result";

export default function LearnClient({ plan, tasks }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  // 新卡先查看再背诵；复习卡默认直接进入背诵态，避免先看原文削弱检索练习
  const [mode, setMode] = useState<Mode>(() =>
    tasks[0] && tasks[0].cardState !== "new" ? "recite" : "view"
  );
  const [userInput, setUserInput] = useState("");
  const [segments, setSegments] = useState<import("@/lib/compare").DiffSegment[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [showKJV, setShowKJV] = useState(false);
  const [fillMode, setFillMode] = useState(false);
  const [fillInputs, setFillInputs] = useState<string[]>([]);
  const [ratingDone, setRatingDone] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [peeked, setPeeked] = useState(false); // 本次背诵是否查看过原文
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
  const ratingLockRef = useRef(false); // 防止评分请求在途时连按 1-4 重复提交

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

  const startRecite = useCallback((t: TaskData) => {
    setUserInput("");
    setSegments([]);
    setAccuracy(0);
    setRatingDone(false);
    setShowOriginal(false);
    setPeeked(false);
    if (fillMode) {
      const density = densityForStability(t.cardStability, t.cardState);
      const blanks = generateFillBlanks(t.content, density);
      setFillInputs(new Array(blanks.blanks.length).fill(""));
    } else {
      setFillInputs([]);
    }
    setMode("recite");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [fillMode]);

  const handleStartRecite = useCallback(() => {
    startRecite(task);
  }, [task, startRecite]);

  /** 切换到指定任务：原子清空全部单次背诵状态，复习卡直接进背诵态、新卡先进查看态 */
  const goToTask = useCallback((idx: number) => {
    const t = tasks[idx];
    if (!t) return;
    setCurrentIdx(idx);
    setUserInput("");
    setSegments([]);
    setAccuracy(0);
    setFillInputs([]);
    setRatingDone(false);
    setShowOriginal(false);
    setPeeked(false);
    setUndoAvailable(false);
    undoCardRef.current = null;
    if (t.cardState !== "new") {
      startRecite(t); // 复习卡直接背诵（会再初始化填空并聚焦）
    } else {
      setMode("view");
    }
  }, [tasks, startRecite]);

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
      if (ratingDone || ratingLockRef.current) return;
      ratingLockRef.current = true;
      try {
        // 用 task 快照做撤销（task 来自本次会话加载，与 cardId 一致）
        undoCardRef.current = {
          id: task.cardId,
          stability: task.cardStability,
          difficulty: task.cardDifficulty,
          reps: task.cardReps,
          lapses: task.cardLapses,
          state: task.cardState,
          lastReview: task.cardLastReview,
          due: task.cardDue,
        };
        const rateRes = await fetch("/api/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: task.cardId, rating }),
        });
        if (!rateRes.ok) {
          console.error("评分保存失败", await rateRes.text());
          return; // 不置 ratingDone，允许重试
        }
        setRatingDone(true);
        setUndoAvailable(true);
      } catch (e) {
        console.error("评分请求异常", e);
      } finally {
        ratingLockRef.current = false;
      }
    },
    [task, ratingDone]
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
    if (currentIdx < totalTasks - 1) goToTask(currentIdx + 1);
  }, [currentIdx, totalTasks, goToTask]);

  // 复习卡初始直接进入背诵态时聚焦输入框
  useEffect(() => {
    if (mode === "recite") {
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [mode]);

  // 键盘处理：keydown 只注册一次，通过 ref 读取"最新"的处理器与状态。
  // 避免切换任务后的一小段窗口内，旧监听器（闭包了上一节 task/输入）把 Enter 或评分误接到上一节，
  // 导致"页面显示 1:4、比对/评分却用了 1:2"的跨节串扰。
  const latest = useRef({
    mode, ratingDone, undoAvailable,
    submit: handleSubmit, rate: handleRate, next: handleNext, undo: handleUndo,
  });
  useEffect(() => {
    latest.current = {
      mode, ratingDone, undoAvailable,
      submit: handleSubmit, rate: handleRate, next: handleNext, undo: handleUndo,
    };
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const l = latest.current;
      if (l.mode === "recite" && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        l.submit();
      }
      if (l.mode === "result" && !l.ratingDone) {
        if (e.key === "1") l.rate(1 as Rating);
        if (e.key === "2") l.rate(2 as Rating);
        if (e.key === "3") l.rate(3 as Rating);
        if (e.key === "4") l.rate(4 as Rating);
        if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          l.next(); // skip without rating
        }
      }
      if (l.mode === "result" && l.ratingDone && l.undoAvailable && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        l.undo();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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

  const isReview = task.cardState !== "new";

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-muted-foreground">
            {task.chapter}:{task.verse}
          </h2>
          <Badge variant={isReview ? "default" : "secondary"}>
            {isReview ? "复习" : "新卡"}
          </Badge>
        </div>
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
                      onClick={() => goToTask(ch.firstIdx)}
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
            onViewOriginal={() => {
              setShowOriginal((s) => !s);
              setPeeked(true);
            }}
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
          recommendedRating={recommendRating(accuracy, { peeked })}
        />
      )}
    </div>
  );
}