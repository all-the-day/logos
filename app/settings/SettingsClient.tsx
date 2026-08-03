"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

export default function SettingsClient() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("导出失败");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logos-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("导出成功", "success");
    } catch {
      toast("导出失败", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      if (!text.trim()) {
        toast("文件为空", "error");
        return;
      }
      const data = JSON.parse(text);
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      toast("导入成功", "success");
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast("导入失败，请检查文件格式", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("确定要清除所有数据吗？此操作不可恢复。")) return;
    try {
      await fetch("/api/data", { method: "DELETE" });
      toast("数据已清除", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast("清除失败", "error");
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">

      <ImportBooksCard />

      <Card>
        <CardHeader><CardTitle>数据管理</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" variant="outline"
            onClick={handleExport} disabled={exporting}>
            {exporting ? "导出中..." : "导出数据 (JSON)"}
          </Button>

          <div>
            <input type="file" accept=".json" className="hidden" id="import-file"
              onChange={handleImport} />
            <label
              htmlFor="import-file"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full",
                importing && "pointer-events-none opacity-50"
              )}
            >
              {importing ? "导入中..." : "导入数据"}
            </label>
          </div>

          <Button className="w-full" variant="destructive"
            onClick={handleClear}>
            清除所有数据
          </Button>
        </CardContent>
      </Card>

      <StatsCard />

      <Card>
        <CardHeader><CardTitle>关于</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Logos v0.1.0 · FSRS 间隔重复 · 恢复本 + KJV · PWA
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard() {
  const [stats, setStats] = useState<{ verses?: number; cards?: number; notes?: number; checkins?: number } | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <Card>
      <CardHeader><CardTitle>数据统计</CardTitle></CardHeader>
      <CardContent>
        {stats ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 rounded-md bg-secondary/50">
              <span className="text-muted-foreground">经文</span>
              <p className="font-medium">{stats.verses} 节</p>
            </div>
            <div className="p-2 rounded-md bg-secondary/50">
              <span className="text-muted-foreground">卡片</span>
              <p className="font-medium">{stats.cards} 张</p>
            </div>
            <div className="p-2 rounded-md bg-secondary/50">
              <span className="text-muted-foreground">笔记</span>
              <p className="font-medium">{stats.notes} 条</p>
            </div>
            <div className="p-2 rounded-md bg-secondary/50">
              <span className="text-muted-foreground">签到</span>
              <p className="font-medium">{stats.checkins} 次</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">加载中...</p>
        )}
      </CardContent>
    </Card>
  );
}

function ImportBooksCard() {
  const router = useRouter();
  const [books, setBooks] = useState<Array<{ id: number; name: string; chapters: number; imported: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<number | null>(null);
  const [selectedNt, setSelectedNt] = useState<number>(0);
  const [selectedOt, setSelectedOt] = useState<number>(0);
  const [lastImported, setLastImported] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理未完成的提示定时器
  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const showNotice = useCallback((msg: string, ms = 3000) => {
    setLastImported(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setLastImported(null), ms);
  }, []);

  useEffect(() => {
    fetch("/api/book/import")
      .then((r) => r.json())
      .then((d) => setBooks(d.books || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleImport = useCallback(async (bookId: number, name: string) => {
    setImporting(bookId);
    try {
      const res = await fetch("/api/book/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (res.ok) {
        setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, imported: true } : b));
        showNotice(name, 3000);
        // 重置选择，避免选中已消失的选项
        setSelectedNt(0);
        setSelectedOt(0);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        console.error("导入失败", data?.error || res.status);
        showNotice(`导入失败：${data?.error || res.status}`, 4000);
      }
    } catch (e) {
      console.error("导入请求异常", e);
      showNotice("导入失败：网络错误", 4000);
    }
    setImporting(null);
  }, [router, showNotice]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">导入书卷</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin">◌</span> 加载书卷列表...
          </div>
        </CardContent>
      </Card>
    );
  }

  const imported = books.filter((b) => b.imported);
  const notImported = books.filter((b) => !b.imported);
  const otAvail = notImported.filter((b) => b.id <= 39);
  const ntAvail = notImported.filter((b) => b.id > 39);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">导入书卷</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          已导入 {imported.length}/66 卷
          {lastImported && (
            <span className={cn("ml-2", lastImported.startsWith("导入失败") ? "text-red-600" : "text-green-600")}>
              {lastImported.startsWith("导入失败") ? "✗ " : "✓ "}
              {lastImported}
            </span>
          )}
        </p>
        {importing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <span className="animate-spin inline-block">⟳</span> 正在导入经文、注解和 KJV 对照...
          </div>
        )}
        {notImported.length === 0 ? (
          <p className="text-sm text-muted-foreground">全部 66 卷已导入 ✓</p>
        ) : (
          <div className="space-y-4">
            {ntAvail.length > 0 && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">新约</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                    value={selectedNt}
                    onChange={(e) => setSelectedNt(Number(e.target.value))}
                    disabled={importing !== null}
                  >
                    <option value={0} disabled>选择新约书卷...</option>
                    {ntAvail.map((b) => (
                      <option key={`nt-${b.id}`} value={b.id}>
                        {b.name}（{b.chapters} 章）
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm"
                  disabled={!selectedNt || importing !== null}
                  onClick={() => {
                    const b = ntAvail.find((x) => x.id === selectedNt);
                    if (b) handleImport(b.id, b.name);
                  }}>
                  {importing ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin inline-block">⟳</span> 导入中
                    </span>
                  ) : "导入"}
                </Button>
              </div>
            )}
            {otAvail.length > 0 && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">旧约</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                    value={selectedOt}
                    onChange={(e) => setSelectedOt(Number(e.target.value))}
                    disabled={importing !== null}
                  >
                    <option value={0} disabled>选择旧约书卷...</option>
                    {otAvail.map((b) => (
                      <option key={`ot-${b.id}`} value={b.id}>
                        {b.name}（{b.chapters} 章）
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm"
                  disabled={!selectedOt || importing !== null}
                  onClick={() => {
                    const b = otAvail.find((x) => x.id === selectedOt);
                    if (b) handleImport(b.id, b.name);
                  }}>
                  {importing ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin inline-block">⟳</span> 导入中
                    </span>
                  ) : "导入"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
