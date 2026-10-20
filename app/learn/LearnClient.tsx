"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { compareVerse, generateFillBlanks, densityForStability } from "@/lib/compare";
import { VerseViewer, VerseReciter, VerseResult } from "@/components/VerseStudy";
import { recommendRating, RATING, type Rating } from "@/lib/fsrs";
import type { PlanInfo, TaskData } from "@/types";

interface Props {
  plan: PlanInfo | null;
  tasks: TaskData[];
  /** 服务端是否配置了在线语音识别 */
  asrEnabled?: boolean;
}

type Mode = "view" | "recite" | "result";

// 会话内重学（AGAIN 重出）：同一张卡在本会话内最多插回队列尾部几次，防死循环
const MAX_REQUEUE_PER_SESSION = 2;

export default function LearnClient({ plan, tasks, asrEnabled = false }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  // 新卡先查看再背诵；复习卡默认直接进入背诵态，避免先看原文削弱检索练习
  const [mode, setMode] = useState<Mode>(() =>
    tasks[0] && tasks[0].cardState !== "new" ? "recite" : "view"
  );
  const [userInput, setUserInput] = useState("");
  const [submitted, setSubmitted] = useState(""); // 实际用于比对的提交文本（结果页展示"你的提交"）
  const [segments, setSegments] = useState<import("@/lib/compare").DiffSegment[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [fillMode, setFillMode] = useState(false);
  const [fillInputs, setFillInputs] = useState<string[]>([]);
  const [ratingDone, setRatingDone] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(false);
  // 会话内重出队列：AGAIN 评分的卡插到队列尾部，本会话内再次背诵
  const [requeued, setRequeued] = useState<TaskData[]>([]);
  const requeueCounts = useRef(new Map<number, number>());

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

  // 有效队列 = 原始任务 + 会话内重出的副本
  const queue = useMemo(() => [...tasks, ...requeued], [tasks, requeued]);
  const task = queue[currentIdx];
  const totalTasks = queue.length;

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
    // 索引动态队列（原始任务 + 会话内重出副本），重出副本在尾部
    const t = queue[idx];
    if (!t) return;
    setCurrentIdx(idx);
    setUserInput("");
    setSubmitted("");
    setSegments([]);
    setAccuracy(0);
    setFillInputs([]);
    setRatingDone(false);
    setUndoAvailable(false);
    undoCardRef.current = null;
    if (t.cardState !== "new") {
      startRecite(t); // 复习卡直接背诵（会再初始化填空并聚焦）
    } else {
      setMode("view");
    }
  }, [queue, startRecite]);

  const handleSubmit = useCallback(() => {
    // 录音中 Enter 不应提交空内容；全文模式必须有输入才进入比对
    if (!fillMode && !userInput.trim()) return;
    let finalInput = userInput;
    if (fillMode) {
      // 填空模式：把用户填入的空还原回整节，再与原文比对。
      // 全部填对才得 100%——否则拿填空词和整节原文比，永远到不了 100%。
      const density = densityForStability(task.cardStability, task.cardState);
      const { display } = generateFillBlanks(task.content, density);
      let rebuilt = "";
      let cursor = 0;
      for (let i = 0; i < display.length; i++) {
        if (display[i] === "_") {
          rebuilt += fillInputs[cursor] ?? "";
          cursor++;
          i += 2; // 跳过 "___" 剩余的两个下划线
        } else {
          rebuilt += display[i];
        }
      }
      finalInput = rebuilt;
    }
    const result = compareVerse(finalInput, task.content);
    setSegments(result.segments);
    setAccuracy(result.accuracy);
    setSubmitted(finalInput);
    setMode("result");
  }, [userInput, fillInputs, fillMode, task]);

  /** 移除该卡在此前会话的重出副本，但保留当前正在展示的那一条（避免队列收缩导致 currentIdx 越界） */
  const pruneRequeued = useCallback(
    (prev: TaskData[], cardId: number): TaskData[] =>
      prev.filter((c, i) => {
        const isActive = tasks.length + i === currentIdx && c.cardId === cardId;
        return c.cardId !== cardId || isActive;
      }),
    [tasks, currentIdx]
  );

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
        const data = (await rateRes.json().catch(() => null)) as {
          card?: { state?: string };
        } | null;
        setRatingDone(true);
        setUndoAvailable(true);

        // 会话内重学：过不过由客观比对决定——没到 100% 一字不差，或自评 AGAIN（看了提示/蒙对），
        // 都插回队列尾部本会话再背。评分仍写入 FSRS，决定下一次复习间隔。
        const mustRequeue = rating === RATING.AGAIN || accuracy < 1;
        const updatedState = data?.card?.state ?? (rating === RATING.AGAIN ? "relearning" : task.cardState);
        if (mustRequeue) {
          const count = requeueCounts.current.get(task.cardId) ?? 0;
          if (count < MAX_REQUEUE_PER_SESSION) {
            requeueCounts.current.set(task.cardId, count + 1);
            setRequeued((prev) => [
              ...pruneRequeued(prev, task.cardId),
              { ...task, cardState: updatedState, requeued: true },
            ]);
          }
        } else {
          // 已过：移除该卡此前的重出副本（保留当前展示项），
          // 防止 undo 后改评 GOOD/EASY 时尾部仍残留一张本应离开会话的卡
          setRequeued((prev) => pruneRequeued(prev, task.cardId));
        }
      } catch (e) {
        console.error("评分请求异常", e);
      } finally {
        ratingLockRef.current = false;
      }
    },
    [task, ratingDone, accuracy, pruneRequeued]
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
      goToTask(currentIdx + 1);
    } else {
      // 最后一节完成：越界索引触发"今日任务已完成"空状态
      setCurrentIdx(totalTasks);
    }
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
            {task.bookName} {task.chapter}:{task.verse}
          </h2>
          <Badge variant={task.requeued ? "destructive" : isReview ? "default" : "secondary"}>
            {task.requeued ? "重学" : isReview ? "复习" : "新卡"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
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
        <VerseReciter
          verse={task}
          fillMode={fillMode}
          fillInputs={fillInputs}
          setFillInputs={setFillInputs}
          userInput={userInput}
          setUserInput={setUserInput}
          inputRef={inputRef}
          onSubmit={handleSubmit}
          asrEnabled={asrEnabled}
        />
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
          recommendedRating={recommendRating(accuracy)}
          submitted={submitted}
        />
      )}
    </div>
  );
}