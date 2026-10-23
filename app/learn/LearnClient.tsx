"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { compareVerse, generateFillBlanks, densityForStability } from "@/lib/compare";
import { VerseViewer, VerseReciter, VerseResult, verseRefLabel } from "@/components/VerseStudy";
import { recommendRating, PASS_ACCURACY, RATING } from "@/lib/fsrs";
import type { PlanInfo, TaskData } from "@/types";

interface Props {
  plan: PlanInfo | null;
  tasks: TaskData[];
  /** 服务端是否配置了在线语音识别 */
  asrEnabled?: boolean;
  /** 自由练习会话：不依赖计划，完成页文案与返回入口不同 */
  practice?: boolean;
}

type Mode = "view" | "recite" | "result";

/**
 * 是否需要先进入查看态：新卡，以及含未学经节的连背组（自由练习可能混合范围）。
 * 已学的单节/连背组直接进背诵态，避免先看原文削弱检索练习。
 */
function needsPreview(task: TaskData | undefined) {
  if (!task) return false;
  return task.cardState === "new" || Boolean(task.hasNew);
}

export default function LearnClient({ plan, tasks, asrEnabled = false, practice = false }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  // 新卡先查看再背诵；复习卡默认直接进入背诵态，避免先看原文削弱检索练习
  const [mode, setMode] = useState<Mode>(() =>
    needsPreview(tasks[0]) ? "view" : "recite"
  );
  const [userInput, setUserInput] = useState("");
  const [submitted, setSubmitted] = useState(""); // 实际用于比对的提交文本（结果页展示"你的提交"）
  const [segments, setSegments] = useState<import("@/lib/compare").DiffSegment[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [fillMode, setFillMode] = useState(false);
  const [fillInputs, setFillInputs] = useState<string[]>([]);
  // 通过后点「下一组」才会写库；保存失败时停在这里提示
  const [commitError, setCommitError] = useState("");
  // 语音录音对象 URL 提升到这里：“返回修改”后组件卸载仍能播放
  const [recordingUrl, setRecordingUrl] = useState("");
  // 语音录音/识别进行中：屏蔽 Enter 与提交，避免误触
  const [voiceBusy, setVoiceBusy] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const committingRef = useRef(false); // 防止「下一组」连点重复入库
  // 每张卡本会话的作答次数与最近一次是否通过（进度点用）
  const attemptsRef = useRef(new Map<number, number>());
  const [sessionStats, setSessionStats] = useState<
    Record<number, { attempts: number; passed: boolean }>
  >({});

  const task = tasks[currentIdx];
  const totalTasks = tasks.length;
  const isPassage = Boolean(task?.isPassage);

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

  /** 切换到指定任务：原子清空全部单次背诵状态 */
  const goToTask = useCallback((idx: number) => {
    const t = tasks[idx];
    if (!t) return;
    setCurrentIdx(idx);
    setUserInput("");
    setSubmitted("");
    setSegments([]);
    setAccuracy(0);
    setFillInputs([]);
    setRecordingUrl(""); // effect cleanup 会 revoke 上一条录音的对象 URL
    if (!needsPreview(t)) {
      startRecite(t); // 已学的单节/组直接背诵（会再初始化填空并聚焦）
    } else {
      setMode("view");
    }
  }, [tasks, startRecite]);

  /**
   * 提交默写：只做比对并展示结果，不写库。
   * 未通过 → 只提供「重新练习」；通过 → 「重新练习」或「下一组」，
   * 点「下一组」才把这一组入库评分。
   */
  const handleSubmit = useCallback(() => {
    // 语音录音/识别进行中不允许提交，避免误触
    if (voiceBusy) return;
    // 语音只是输入方式：识别文本填进输入框后，直接走既有文本比对，不另设门槛
    if (!fillMode && !userInput.trim()) return;
    let finalInput = userInput;
    if (fillMode && !isPassage) {
      // 填空模式：把用户填入的空还原回整节，再与原文比对
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
    setCommitError("");
    setMode("result");

    const attempts = (attemptsRef.current.get(task.cardId) ?? 0) + 1;
    attemptsRef.current.set(task.cardId, attempts);
    setSessionStats((prev) => ({
      ...prev,
      [task.cardId]: { attempts, passed: result.accuracy >= PASS_ACCURACY },
    }));
  }, [userInput, fillInputs, fillMode, task, isPassage, voiceBusy]);

  /** 未通过 / 通过后想再练一遍：清空输入回到默写态，不写库 */
  const handleRetryCurrent = useCallback(() => {
    if (!task) return;
    setUserInput("");
    setSubmitted("");
    setSegments([]);
    setAccuracy(0);
    setFillInputs([]);
    setCommitError("");
    setMode("recite");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [task]);

  /**
   * 通过后的「下一组」：此时才把评分写入 FSRS，然后进入下一项。
   * 最后一项点它即结束本次会话（不再单独放「完成」按钮）。
   */
  const handleNext = useCallback(async () => {
    if (!task || committingRef.current) return;
    if (accuracy >= PASS_ACCURACY) {
      committingRef.current = true;
      setCommitError("");
      try {
        const attempts = sessionStats[task.cardId]?.attempts ?? 1;
        // 补考通过不高于「正确」，避免反复试错拿到跟一次背对一样的间隔
        const rating = Math.min(
          recommendRating(accuracy),
          attempts > 1 ? RATING.GOOD : RATING.EASY
        );
        const res = await fetch("/api/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            task.isPassage && task.cardIds?.length
              ? { ratings: task.cardIds.map((cardId) => ({ cardId, rating })) }
              : { cardId: task.cardId, rating }
          ),
        });
        if (!res.ok) {
          console.error("评分保存失败", await res.text());
          setCommitError("入库失败，请重试");
          return;
        }
      } catch (e) {
        console.error("评分请求异常", e);
        setCommitError("入库失败，请重试");
        return;
      } finally {
        committingRef.current = false;
      }
    }
    if (currentIdx < totalTasks - 1) {
      goToTask(currentIdx + 1);
    } else {
      // 最后一节：越界索引触发"今日任务已完成"空状态
      setCurrentIdx(totalTasks);
    }
  }, [task, accuracy, sessionStats, currentIdx, totalTasks, goToTask]);

  // 复习卡初始直接进入背诵态时聚焦输入框
  useEffect(() => {
    if (mode === "recite") {
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [mode]);

  // 释放录音对象 URL：换新录音、切换任务或组件卸载时（避免内存泄漏）
  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  // 键盘处理：keydown 只注册一次，通过 ref 读取"最新"的处理器与状态。
  // 避免切换任务后的一小段窗口内，旧监听器（闭包了上一节 task/输入）把 Enter 误接到上一节，
  // 导致"页面显示 1:4、比对却用了 1:2"的跨节串扰。
  // 结果页只保留 Space：通过时等于「下一组」（入库并前进）。
  const latest = useRef({
    mode, voiceBusy,
    submit: handleSubmit, next: handleNext,
  });
  useEffect(() => {
    latest.current = {
      mode, voiceBusy,
      submit: handleSubmit, next: handleNext,
    };
  });
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const l = latest.current;
      // 语音录音/识别期间屏蔽所有学习快捷键，避免误触
      if (l.voiceBusy) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
        }
        return;
      }
      if (l.mode === "recite" && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        l.submit();
      }
      if (l.mode === "result" && (e.key === " " || e.key === "Spacebar")) {
        e.preventDefault();
        void l.next();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!plan && !practice) {
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
        <p className="text-muted-foreground">
          {practice ? "练习完成！" : "今日任务已完成！"}
        </p>
        {practice ? (
          <div className="space-y-2">
            <Link href="/practice" className={cn(buttonVariants({}), "w-full")}>
              再练一组
            </Link>
            <Link href="/plan" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              返回计划
            </Link>
          </div>
        ) : (
          <Link href="/plan" className={buttonVariants({})}>返回</Link>
        )}
      </div>
    );
  }

  const isReview = task.cardState !== "new";
  const isPassageTask = isPassage;
  const verseLabel = verseRefLabel(task);
  // 首答通过数：只统计"第一次提交就 ≥90%"的项（补考通过不算）
  const firstPassCount = tasks.reduce((count, t) => {
    const stat = sessionStats[t.cardId];
    return count + (stat?.passed && stat.attempts === 1 ? 1 : 0);
  }, 0);

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium text-muted-foreground">{verseLabel}</h2>
          {practice && <Badge variant="outline">自由练习</Badge>}
          <Badge variant={isReview ? "default" : "secondary"}>
            {isReview ? "复习" : "新卡"}
          </Badge>
          {isPassageTask && <Badge variant="outline">连背 {task.cardIds?.length ?? 1} 节</Badge>}
          {isReview && task.hasNew && <Badge variant="secondary">含新卡</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {!isPassageTask && (
            <Button variant="ghost" size="sm" onClick={() => setFillMode(!fillMode)}>
              {fillMode ? "全文" : "填空"}
            </Button>
          )}
          <Badge variant="outline">
            {currentIdx + 1}/{totalTasks}
          </Badge>
        </div>
      </div>

      {/*
        进度点只表示"位置"（已过/当前/未到），不使用通过/未通过的状态色：
        通过与否已由结果页按钮的语义色表达，再上一套颜色会重复且显得杂乱。
        单项会话没有进度可言，整行不显示。
      */}
      {tasks.length > 1 && (
        <div
          className="flex items-center justify-between gap-2"
          aria-label={`本轮共 ${tasks.length} 项，首答通过 ${firstPassCount} 项`}
        >
          <div className="flex flex-wrap items-center gap-1">
            {tasks.map((t, i) => {
              const tone =
                i < currentIdx
                  ? "bg-muted-foreground/40"
                  : i === currentIdx
                    ? "bg-primary"
                    : "bg-muted-foreground/15";
              return (
                <span
                  key={`${t.cardId}-${i}`}
                  className={cn("h-1.5 w-3 rounded-full transition-colors", tone)}
                />
              );
            })}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            首答 {firstPassCount}/{tasks.length}
          </span>
        </div>
      )}

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
          recordingUrl={recordingUrl}
          setRecordingUrl={setRecordingUrl}
          onVoiceBusyChange={setVoiceBusy}
        />
      )}

      {mode === "result" && (
        <VerseResult
          verse={task}
          segments={segments}
          accuracy={accuracy}
          passed={accuracy >= PASS_ACCURACY}
          onNext={handleNext}
          nextLabel={isPassageTask ? "下一组" : "下一节"}
          verseId={isPassageTask ? undefined : task.id}
          submitted={submitted}
          commitError={commitError}
          onRetry={handleRetryCurrent}
        />
      )}
    </div>
  );
}