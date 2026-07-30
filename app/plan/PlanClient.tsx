"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import ProgressBar from "@/components/ProgressBar";
import BookSelector from "@/components/BookSelector";
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
}

export default function PlanClient({
  planDetails,
  progress,
  books,
  checkin,
  dailyVerse,
}: PlanClientProps) {
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [versesPerDay, setVersesPerDay] = useState(3);
  const [creating, setCreating] = useState(false);
  const [checkinState, setCheckinState] = useState(checkin);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!selectedBook) return;
    setCreating(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: selectedBook, versesPerDay }),
      });
      if (res.ok) window.location.reload();
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
          已经导入 {books.length} 卷，可用的书卷：
        </p>
        <ImportSection existingBooks={books} />
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const { plan, book, totalVerses, workdays } = planDetails;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col min-h-[calc(100vh-5rem)] space-y-4">

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

      <Card className="mt-auto shadow-md border-muted/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{book?.name}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                每日 {plan.versesPerDay} 节 · {totalVerses} 节 · {workdays} 个工作日
              </div>
            </div>
            <Badge variant="secondary">学习中</Badge>
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
          <div className="flex gap-2">
            <Link href="/learn" className={cn(buttonVariants({}), "flex-1")}>
              开始学习
            </Link>
            <Link href="/review" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
              复习
            </Link>
          </div>
          <Button variant="ghost" size="sm"
            className="w-full text-muted-foreground"
            onClick={handleDelete} disabled={deleting}>
            {deleting ? "删除中..." : "删除计划"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ImportSection({ existingBooks }: { existingBooks: BookInfo[] }) {
  const [avail, setAvail] = useState<Array<{ id: number; name: string; imported: boolean }>>([]);
  const [importing, setImporting] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/book/import")
      .then((r) => r.json())
      .then((d) => setAvail(d.books || []))
      .catch(() => {});
  }, [existingBooks]);

  const notImported = avail.filter((b) => !b.imported);
  if (notImported.length === 0) return null;

  const handleImport = async (bookId: number) => {
    setImporting(bookId);
    try {
      await fetch("/api/book/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      setAvail((prev) => prev.map((b) => b.id === bookId ? { ...b, imported: true } : b));
      // 刷新页面以更新书卷列表
      setTimeout(() => window.location.reload(), 500);
    } catch { /* ignore */ }
    setImporting(null);
  };

  const ot = notImported.filter((b) => b.id <= 39);
  const nt = notImported.filter((b) => b.id > 39);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="text-sm">
          导入书卷 {open ? "▲" : "▼"} <span className="text-muted-foreground font-normal">({notImported.length} 卷可用)</span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 pt-0">
          {nt.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground w-full mb-1">新约</span>
              {nt.map((b) => (
                <Button key={b.id} variant="outline" size="sm"
                  disabled={importing === b.id}
                  onClick={() => handleImport(b.id)}>
                  {importing === b.id ? "导入中..." : b.name}
                </Button>
              ))}
            </div>
          )}
          {ot.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground w-full mb-1">旧约</span>
              {ot.map((b) => (
                <Button key={b.id} variant="outline" size="sm"
                  disabled={importing === b.id}
                  onClick={() => handleImport(b.id)}>
                  {importing === b.id ? "导入中..." : b.name}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
