"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import ProgressBar from "@/components/ProgressBar";
import BookSelector from "@/components/BookSelector";
import { getTodayLabel } from "@/lib/date";
import type {
  BookInfo,
  PlanInfo,
  CardProgress,
  DailyVerse,
} from "@/types";

interface PlanClientProps {
  planDetails: {
    plan: PlanInfo | null;
    book: BookInfo | null;
    totalVerses: number;
    workdays: number;
  } | null;
  progress: CardProgress | null;
  books: BookInfo[];
  checkin: { checkedIn: boolean; streak: number };
  dailyVerse: DailyVerse | null;
  todaySummary: { review: number; new: number } | null;
  todayReviewed: number;
}

export default function PlanClient({
  planDetails,
  progress,
  books,
  checkin,
  dailyVerse,
  todaySummary,
  todayReviewed,
}: PlanClientProps) {
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [versesPerDay, setVersesPerDay] = useState(3);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [checkinState, setCheckinState] = useState(checkin);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!selectedBook) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: selectedBook, versesPerDay }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        setCreateError(data?.error || `创建失败 (${res.status})`);
      }
    } catch (e) {
      setCreateError(`网络错误：${e instanceof Error ? e.message : "无法连接服务器"}`);
    } finally {
      setCreating(false);
    }
  }, [selectedBook, versesPerDay]);

  const handleDelete = useCallback(async () => {
    if (!confirm("确定要删除当前计划吗？")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/plan", { method: "DELETE" });
      if (res.ok) window.location.reload();
    } finally {
      setDeleting(false);
    }
  }, []);

  const handleCheckin = useCallback(async () => {
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCheckinState({ checkedIn: true, streak: data.streak });
      }
    } catch { /* ignore */ }
  }, []);

  if (!planDetails?.plan) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <p className="text-muted-foreground">
          还没有学习计划，创建一个开始背经吧。
        </p>
        <Card>
          <CardHeader>
            <CardTitle>新建背诵计划</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">选择书卷</label>
              <BookSelector
                books={books}
                selectedId={selectedBook}
                onSelect={setSelectedBook}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">每日节数</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setVersesPerDay(Math.max(1, versesPerDay - 1))}>
                  -
                </Button>
                <span className="w-12 text-center font-medium">{versesPerDay}</span>
                <Button variant="outline" size="sm"
                  onClick={() => setVersesPerDay(Math.min(10, versesPerDay + 1))}>
                  +
                </Button>
                <span className="text-sm text-muted-foreground ml-2">节/天</span>
              </div>
            </div>
            {selectedBook && (
              <div className="text-sm text-muted-foreground p-3 bg-secondary rounded-lg">
                书卷：<span className="font-medium text-foreground">{books.find(b => b.id === selectedBook)?.name}</span>
              </div>
            )}
            <Button className="w-full" disabled={!selectedBook || creating}
              onClick={handleCreate}>
              {creating ? "创建中..." : "开始背诵"}
            </Button>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { plan, book, totalVerses } = planDetails;
  const review = todaySummary?.review ?? 0;
  const newCount = todaySummary?.new ?? 0;
  const hasTasks = review + newCount > 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col min-h-[calc(100vh-5rem)] space-y-4">

      <div className="text-sm text-muted-foreground">
        {getTodayLabel()}
      </div>

      {/* 今日任务卡（唯一 CTA → /learn） */}
      <Card>
        <CardHeader>
          <CardTitle>今日任务</CardTitle>
          <div className="text-sm text-muted-foreground">
            待复习 {review} 节 · 新经文 {newCount} 节
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasTasks ? (
            <Link href="/learn" className={cn(buttonVariants({}), "w-full")}>
              开始今日学习
            </Link>
          ) : (
            <Button className="w-full" disabled>
              今日已完成
            </Button>
          )}
          <div className="text-sm text-muted-foreground text-center">
            今日已完成 {todayReviewed} 节
          </div>
        </CardContent>
      </Card>

      {/* 签到→金句槽位（原样保留）：未签到显示签到卡，已签到显示每日金句 */}
      {!checkinState.checkedIn ? (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">今日签到</div>
                <div className="text-2xl font-bold">未签到</div>
                <div className="text-sm text-muted-foreground">
                  连续 {checkinState.streak} 天
                </div>
              </div>
              <Button onClick={handleCheckin} size="lg">
                签到
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : dailyVerse ? (
        <div className="text-center py-8 px-6">
          <p className="text-xl leading-relaxed max-w-[66%] mx-auto">{dailyVerse.content}</p>
          <p className="text-sm text-muted-foreground mt-4">
            {dailyVerse.book} {dailyVerse.chapter}:{dailyVerse.section}
          </p>
        </div>
      ) : null}

      {/* 书卷进度卡（纯展示 + "…"菜单删除计划） */}
      <Card className="mt-auto shadow-md border-muted/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{book?.name}</CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant="secondary">学习中</Badge>
              <details className="relative">
                <summary
                  className="list-none cursor-pointer p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
                  aria-label="更多操作"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </summary>
                <div className="absolute right-0 mt-2 w-36 rounded-md border bg-background shadow-md z-10 overflow-hidden">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-secondary cursor-pointer"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "删除中..." : "删除计划"}
                  </button>
                </div>
              </details>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress && (
            <ProgressBar
              mastered={progress.mastered}
              learning={progress.learning}
              newCount={progress.new}
              total={progress.total}
            />
          )}
          <div className="text-sm text-muted-foreground">
            每日 {plan.versesPerDay} 节 · 已学 {progress?.total ?? 0}/{totalVerses}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
