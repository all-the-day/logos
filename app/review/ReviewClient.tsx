"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { compareVerse } from "@/lib/compare";
import { VerseViewer, VerseReciter, VerseResult } from "@/components/VerseStudy";
import type { DiffSegment } from "@/lib/compare";
import type { Rating } from "@/lib/fsrs";
import type { CardData } from "@/types";

type Mode = "list" | "view" | "recite" | "result";

interface Props {
  cards: CardData[];
}

export default function ReviewClient({ cards: initialCards }: Props) {
  const [mode, setMode] = useState<Mode>("list");
  const [currentIdx, setCurrentIdx] = useState(0);
  const cards = initialCards;
  const [userInput, setUserInput] = useState("");
  const [segments, setSegments] = useState<DiffSegment[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
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

  const card = cards[currentIdx];
  const verse = card?.verse;

  // Accuracy estimate from stability
  const estAccuracy = card
    ? card.stability >= 21 ? 95 : card.stability >= 5 ? 70 : 30
    : 0;

  // ── handlers ─────────────────────────────────────

  const handleStartRecite = useCallback(() => {
    setUserInput("");
    setSegments([]);
    setAccuracy(0);
    setRatingDone(false);
    setMode("recite");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!verse) return;
    const result = compareVerse(userInput, verse.content);
    setSegments(result.segments);
    setAccuracy(result.accuracy);
    setMode("result");
  }, [userInput, verse]);

  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!card) return;
      setRatingDone(true);
      setUndoAvailable(false);
      // Save current card state for undo
      undoCardRef.current = {
        id: card.id,
        stability: card.stability,
        difficulty: card.difficulty,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state,
        lastReview: card.lastReview,
        due: card.due,
      };
      try {
        await fetch("/api/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card.id, rating }),
        });
        setUndoAvailable(true);
      } catch { /* ignore */ }
    },
    [card]
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
    if (currentIdx < cards.length - 1) {
      setCurrentIdx((i) => i + 1);
      setMode("view");
      setUserInput("");
      setSegments([]);
      setRatingDone(false);
    } else {
      // All done - back to list
      setCurrentIdx(0);
      setMode("list");
      setUserInput("");
    }
  }, [currentIdx, cards.length]);

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
      if (mode === "list" && e.key === "Escape") {
        // Go back to plan from list
      }
      if (mode === "result" && ratingDone && undoAvailable && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, ratingDone, handleSubmit, handleRate, handleNext, handleUndo, undoAvailable]);

  // ── render ────────────────────────────────────────

  if (cards.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">复习</h1>
        <p className="text-muted-foreground">没有需要复习的经文。</p>
      </div>
    );
  }

  // ── List mode ─────────────────────────────────────
  if (mode === "list") {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">复习</h1>
        <p className="text-muted-foreground">
          {cards.length} 节经文等待复习
        </p>

        {cards.map((c, i) => {
          if (!c.verse) return null;
          const accColor =
            c.stability >= 21 ? "bg-green-500"
            : c.stability >= 5 ? "bg-orange-400"
            : "bg-red-400";
          return (
            <Card
              key={c.id}
              className="cursor-pointer transition-opacity hover:opacity-100 hover:ring-1 hover:ring-primary/30"
              onClick={() => {
                setCurrentIdx(i);
                setMode("view");
              }}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">
                    {c.verse.chapter}:{c.verse.verse}
                  </span>
                  <span className={`ml-2 w-2 h-2 rounded-full inline-block ${accColor}`} />
                </div>
                <span className="text-xs text-muted-foreground">
                  复习 {c.reps} 次
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  if (!card || !verse) return null;

  // ── View / Recite / Result modes ──────────────────
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-muted-foreground">
          {verse.chapter}:{verse.verse}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("list")}>
            返回列表
          </Button>
          <span className="text-xs text-muted-foreground">
            掌握度 {estAccuracy}%
          </span>
        </div>
      </div>

      {mode === "view" && (
        <VerseViewer
          verse={verse}
          showKJV={false}
          onStart={handleStartRecite}
        />
      )}

      {mode === "recite" && (
        <VerseReciter
          verse={verse}
          fillMode={false}
          fillInputs={[]}
          setFillInputs={() => {}}
          userInput={userInput}
          setUserInput={setUserInput}
          inputRef={inputRef}
          onSubmit={handleSubmit}
        />
      )}

      {mode === "result" && (
        <VerseResult
          verse={verse}
          segments={segments}
          accuracy={accuracy}
          ratingDone={ratingDone}
          onRate={handleRate}
          onNext={handleNext}
          nextLabel={
            currentIdx >= cards.length - 1 ? "完成" : "下一节"
          }
          verseId={card.verseId}
          onUndo={undoAvailable ? handleUndo : undefined}
        />
      )}
    </div>
  );
}
