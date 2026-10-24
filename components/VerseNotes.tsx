"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface NoteItem {
  id: number;
  content: string;
  createdAt: string;
}

interface Props {
  verseId: number;
}

export default function VerseNotes({ verseId }: Props) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/note?verseId=${verseId}`)
      .then((r) => r.json())
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [verseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseId, content: content.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || `保存失败 (${res.status})`);
        return;
      }
      setContent("");
      setShowForm(false);
      load(); // 重新拉取当前经节笔记
    } catch {
      setError("网络错误，保存失败");
    } finally {
      setSaving(false);
    }
  }, [content, verseId, load]);

  if (loading) return null;

  return (
    <details className="group">
      <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
        笔记{notes.length > 0 && ` (${notes.length})`}
      </summary>
      <div className="mt-2 space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="text-sm p-2 rounded-md bg-secondary/50">
            <p className="whitespace-pre-wrap">{note.content}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(note.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
        ))}

        {showForm ? (
          <div className="space-y-2 rounded-md border p-3">
            <textarea
              className="w-full min-h-20 px-3 py-2 border rounded-md bg-background text-sm resize-none"
              placeholder="针对这一节写点心得..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setContent("");
                  setError(null);
                }}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={!content.trim() || saving}
                onClick={handleCreate}
              >
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            添加笔记
          </Button>
        )}
      </div>
    </details>
  );
}
