"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

export default function SettingsClient({ user }: { user: { id: number; username: string; name: string; role: string } }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };

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
      const res = await fetch("/api/data", { method: "DELETE" });
      if (!res.ok) {
        toast("清除失败", "error");
        return;
      }
      toast("数据已清除", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast("清除失败", "error");
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.username}</div>
              {user.role === "admin" && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">管理员</span>
              )}
            </div>
            <div className="flex gap-2">
              {user.role === "admin" && (
                <Button variant="outline" size="sm" onClick={() => window.location.href = "/admin"}>
                  后台管理
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                退出登录
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <FeedbackCard />

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

function FeedbackCard() {
  const [type, setType] = useState("suggestion");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState<Array<{ id: number; type: string; content: string; status: string; createdAt: string }>>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((d) => setList(d.feedback || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        setNotice("已提交，感谢反馈！");
        const data = await res.json();
        setList((prev) => [data.feedback, ...prev]);
      } else {
        const data = await res.json().catch(() => null);
        setNotice(data?.error || "提交失败");
      }
    } catch {
      setNotice("网络错误，提交失败");
    }
    setSubmitting(false);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleToggle = async (id: number, status: string) => {
    const newStatus = status === "open" ? "resolved" : "open";
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setList((prev) => prev.map((f) => f.id === id ? { ...f, status: newStatus } : f));
  };

  const typeLabel: Record<string, string> = { bug: "Bug", suggestion: "优化建议", other: "其他" };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">反馈</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <select
            className="flex-none px-3 py-2 border rounded-md bg-background text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="bug">Bug</option>
            <option value="suggestion">优化建议</option>
            <option value="other">其他</option>
          </select>
          <textarea
            className="flex-1 px-3 py-2 border rounded-md bg-background text-sm resize-none"
            rows={2}
            placeholder="记录你遇到的问题或功能建议..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          {notice ? (
            <span className="text-xs text-muted-foreground">{notice}</span>
          ) : <span />}
          <Button size="sm" disabled={!content.trim() || submitting}
            onClick={handleSubmit}>
            {submitting ? "提交中..." : "提交"}
          </Button>
        </div>

        {list.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">历史反馈 ({list.length})</p>
            {list.map((f) => (
              <div key={f.id} className="flex items-start justify-between gap-2 p-2 rounded-md bg-secondary/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {typeLabel[f.type] || f.type}
                    </span>
                    <span className={`text-xs ${f.status === "open" ? "text-amber-600" : "text-green-600"}`}>
                      {f.status === "open" ? "待处理" : "已处理"}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{f.content}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(f.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
                <button
                  className="flex-none text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => handleToggle(f.id, f.status)}
                >
                  {f.status === "open" ? "标记已处理" : "重开"}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
