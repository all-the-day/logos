"use client";

import { useState } from "react";
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
      <h1 className="text-2xl font-bold">设置</h1>

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
