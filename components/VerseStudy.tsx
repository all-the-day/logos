"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RATING } from "@/lib/fsrs";
import { generateFillBlanks } from "@/lib/compare";
import { cn } from "@/lib/utils";
import {
  createRecorder,
  convertToWav,
  getRecordingSupport,
  MAX_RECORD_SECONDS,
  type Recorder,
} from "@/lib/audio/recorder";
import VerseNotes from "./VerseNotes";
import type { DiffSegment } from "@/lib/compare";
import type { Rating } from "@/lib/fsrs";

// ─── Shared types ─────────────────────────────────────────

export interface VerseRef {
  id: number;
  bookName: string;
  chapter: number;
  verse: number;
  content: string;
  kjv: string | null;
}

// ─── VerseViewer（view 态：仅经节引用，不显示原文） ──
export function VerseViewer({
  verse,
  onStart,
  showFillOption,
}: {
  verse: VerseRef;
  onStart: () => void;
  showFillOption?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <p className="text-xl leading-relaxed font-medium">
          {verse.bookName} {verse.chapter}:{verse.verse}
        </p>
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
  asrEnabled = false,
  recordingUrl,
  setRecordingUrl,
}: {
  verse: VerseRef;
  fillMode: boolean;
  fillInputs: string[];
  setFillInputs: (v: string[]) => void;
  userInput: string;
  setUserInput: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: () => void;
  /** 服务端是否已配置在线语音识别；未配置时不显示语音入口 */
  asrEnabled?: boolean;
  /** 录音对象 URL 由 LearnClient 持有，供“返回修改”后仍能播放 */
  recordingUrl: string;
  setRecordingUrl: (url: string) => void;
}) {
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceError, setVoiceError] = useState("");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // 移动端长按：手指可能在 recorder.start() 完成前就松开，用这个标记兜底取消
  const releasedWhileStartingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (voiceState !== "recording") return;
    const timer = window.setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [voiceState]);

  const stopVoice = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    setVoiceState("transcribing");
    setVoiceError("");
    try {
      const recorded = await recorder.stop();
      const wav = await convertToWav(recorded);

      const form = new FormData();
      form.append("audio", new File([wav], "recite.wav", { type: "audio/wav" }));
      form.append("verseId", String(verse.id));

      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/asr", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || `语音识别失败 (${response.status})`);
      }
      if (!mountedRef.current) return;
      setUserInput(data?.text ?? "");
      setRecordingUrl(URL.createObjectURL(recorded));
      setVoiceState("idle");
      setRecordSeconds(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setVoiceState("idle");
      setRecordSeconds(0);
      setVoiceError(error instanceof Error ? error.message : "语音识别失败，请改用手动输入");
    } finally {
      recorderRef.current = null;
      abortRef.current = null;
    }
  }, [verse.id, setUserInput, inputRef, setRecordingUrl]);

  useEffect(() => {
    if (voiceState === "recording" && recordSeconds >= MAX_RECORD_SECONDS) {
      void stopVoice();
    }
  }, [recordSeconds, voiceState, stopVoice]);

  const cancelVoice = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) recorder.cancel();
    recorderRef.current = null;
    setVoiceState("idle");
    setRecordSeconds(0);
    setVoiceError("已取消录音");
  }, []);

  const startVoice = useCallback(async () => {
    if (!getRecordingSupport()) {
      setVoiceError("当前浏览器不支持录音，请使用文字输入");
      return;
    }

    setVoiceError("");
    setRecordSeconds(0);
    releasedWhileStartingRef.current = false;
    const recorder = createRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start();
      if (!mountedRef.current) {
        recorder.cancel();
        return;
      }
      // 长按松手早于 start 完成：直接取消，避免留下一录到 60 秒的录音
      if (releasedWhileStartingRef.current) {
        recorder.cancel();
        recorderRef.current = null;
        setVoiceState("idle");
        setRecordSeconds(0);
        return;
      }
      setVoiceState("recording");
    } catch (error) {
      recorder.cancel();
      recorderRef.current = null;
      if (!mountedRef.current) return;
      setVoiceError(error instanceof Error ? error.message : "无法开始录音");
    }
  }, []);

  const handleVoiceStart = useCallback(
    (event: React.TouchEvent) => {
      // 长按录音：阻止默认行为，避免触发滚动/文本选择/系统菜单
      event.preventDefault();
      if (voiceState === "idle") void startVoice();
    },
    [voiceState, startVoice]
  );

  const handleVoiceEnd = useCallback(() => {
    if (voiceState === "recording") {
      void stopVoice();
    } else if (voiceState === "idle") {
      // start 尚未完成就松手：标记后由 startVoice 兜底取消
      releasedWhileStartingRef.current = true;
    }
  }, [voiceState, stopVoice]);

  const voiceControls = asrEnabled && (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Button
          variant={voiceState === "recording" ? "destructive" : "outline"}
          size="sm"
          type="button"
          className="touch-none select-none"
          disabled={voiceState === "transcribing"}
          onTouchStart={handleVoiceStart}
          onTouchEnd={handleVoiceEnd}
          onTouchCancel={cancelVoice}
          onContextMenu={(event) => event.preventDefault()}
        >
          {voiceState === "recording" ? (
            <><Square className="size-3.5" /> 松开结束</>
          ) : voiceState === "transcribing" ? (
            "识别中..."
          ) : (
            <><Mic className="size-3.5" /> 长按语音输入</>
          )}
        </Button>
        {voiceState === "recording" && (
          <span className="text-xs text-muted-foreground">
            {recordSeconds}s / {MAX_RECORD_SECONDS}s
          </span>
        )}
        {voiceState === "transcribing" && (
          <span className="text-xs text-muted-foreground">正在识别，请稍候</span>
        )}
      </div>
      {voiceError && <p className="text-xs text-destructive" role="alert">{voiceError}</p>}
      {recordingUrl && (
        <div className="space-y-1.5">
          <audio controls src={recordingUrl} className="w-full" preload="none" />
          <p className="text-xs text-muted-foreground">
            播放我的录音（可选核对）：ASR 可能有谐音字或自动纠错，漏背以比对结果为准。
          </p>
        </div>
      )}
    </div>
  );

  const header = (
    <p className="text-lg font-medium truncate">{verse.bookName} {verse.chapter}:{verse.verse}</p>
  );

  if (fillMode) {
    const blanks = generateFillBlanks(verse.content);
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {header}
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
        {header}
        <textarea
          ref={inputRef}
          className="w-full min-h-32 px-3 py-2 border rounded-md bg-background text-lg resize-none"
          placeholder="在此输入经文..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(event) => {
            // 长按录音/识别期间屏蔽 Enter，避免误提交
            if (voiceState !== "idle" && event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        />
        {voiceControls}
        <Button className="w-full" onClick={onSubmit} disabled={!userInput.trim()}>
          提交 (Enter)
        </Button>
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
  verseId,
  onUndo,
  recommendedRating,
  submitted,
  onEdit,
}: {
  verse: VerseRef;
  segments: DiffSegment[];
  accuracy: number;
  ratingDone: boolean;
  onRate: (r: Rating) => void;
  onNext: () => void;
  nextLabel?: string;
  verseId?: number;
  onUndo?: () => void;
  recommendedRating?: Rating;
  /** 用户实际提交用于比对的文本（反馈 #13：结果页展示"你的提交"） */
  submitted?: string;
  /** 未评分时允许返回修改识别文本/录音 */
  onEdit?: () => void;
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

      {submitted && (
        <Card>
          <CardHeader><CardTitle>你的提交</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg leading-relaxed whitespace-pre-wrap text-muted-foreground">{submitted}</p>
          </CardContent>
        </Card>
      )}

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

      {verseId && <VerseNotes verseId={verseId} />}

      {!ratingDone && (
        <Card>
          <CardHeader><CardTitle>评分</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {([RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY] as Rating[]).map((r) => {
                const labels: Record<number, string> = { 1: "忘记", 2: "困难", 3: "正确", 4: "容易" };
                const isRecommended = recommendedRating === r;
                return (
                  <Button
                    key={r}
                    variant={isRecommended ? "default" : "outline"}
                    onClick={() => onRate(r)}
                    className={cn("flex-col py-4 h-auto", isRecommended && "ring-2 ring-primary ring-offset-2")}
                  >
                    <span>{labels[r]}{isRecommended && " ★"}</span>
                    <span className="text-xs text-muted-foreground mt-1">{r}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              {recommendedRating ? "★ 智能推荐 · 按 1-4 评分 · 空格跳过" : "按 1-4 评分 · 空格跳过"}
            </p>
          </CardContent>
        </Card>
      )}

      {ratingDone && (
        <div className="space-y-2">
          <Button className="w-full" onClick={onNext}>
            {nextLabel || "下一节"}
          </Button>
          {onUndo && (
            <Button variant="ghost" size="sm" className="w-full" onClick={onUndo}>
              撤销 (U)
            </Button>
          )}
        </div>
      )}

      {!ratingDone && onEdit && (
        <Button variant="outline" className="w-full" onClick={onEdit}>
          返回修改
        </Button>
      )}
    </div>
  );
}
