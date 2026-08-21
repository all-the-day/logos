"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Layers,
  StickyNote,
  CalendarCheck,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

export default function SettingsClient({ user }: { user: { id: number; username: string; name: string; role: string } }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState("");
  const [clearing, setClearing] = useState(false);
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
    setClearing(true);
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
    } finally {
      setClearing(false);
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
            {exporting ? "导出中..." : "本地备份 (JSON)"}
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
              {importing ? "导入中..." : "从备份恢复"}
            </label>
          </div>
        </CardContent>
      </Card>

      <StatsCard />

      <FeedbackCard />

      <Card className="border-red-200">
        <CardHeader><CardTitle className="text-red-600">危险操作</CardTitle></CardHeader>
        <CardContent>
          <Button className="w-full" variant="outline"
            onClick={() => setClearOpen(true)}>
            清除所有数据
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            清空全部卡片、笔记、签到与计划，不可恢复。建议先导出备份。
          </p>
        </CardContent>
      </Card>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">确认清除所有数据？</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              此操作不可恢复。请输入 <span className="font-medium text-foreground">清除</span> 以确认：
            </p>
            <Input
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder="清除"
            />
            <Button className="w-full" variant="destructive"
              disabled={clearConfirm !== "清除" || clearing}
              onClick={handleClear}>
              {clearing ? "清除中..." : "确认清除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
            <div className="p-2.5 rounded-md bg-secondary/50">
              <BookOpen className="w-4 h-4 text-muted-foreground mb-1" />
              <span className="text-muted-foreground">经文</span>
              <p className="font-medium">{stats.verses} 节</p>
            </div>
            <div className="p-2.5 rounded-md bg-secondary/50">
              <Layers className="w-4 h-4 text-muted-foreground mb-1" />
              <span className="text-muted-foreground">卡片</span>
              <p className="font-medium">{stats.cards} 张</p>
            </div>
            <div className="p-2.5 rounded-md bg-secondary/50">
              <StickyNote className="w-4 h-4 text-muted-foreground mb-1" />
              <span className="text-muted-foreground">笔记</span>
              <p className="font-medium">{stats.notes} 条</p>
            </div>
            <div className="p-2.5 rounded-md bg-secondary/50">
              <CalendarCheck className="w-4 h-4 text-muted-foreground mb-1" />
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
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("suggestion");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState<Array<{ id: number; type: string; content: string; status: string; createdAt: string }>>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((d) => setList(d.feedback || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const typeLabel: Record<string, string> = { bug: "Bug", suggestion: "优化建议", other: "其他" };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">关于</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">logos v0.1.0 · 仅供个人使用</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {list.length > 0 ? `历史反馈 ${list.length} 条` : "遇到问题或有建议？告诉我们"}
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            我要反馈
          </Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>我要反馈</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
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
                    <div key={f.id} className="p-2 rounded-md bg-secondary/40">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">#{f.id}</span>
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
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
