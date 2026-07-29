"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NoteData, VerseData, BookInfo } from "@/types";

interface Props {
  notes: (NoteData & { verse: VerseData })[];
  books: BookInfo[];
}

export default function NotesClient({ notes, books }: Props) {
  const [editNote, setEditNote] = useState<(NoteData & { verse: VerseData }) | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newBookId, setNewBookId] = useState<number>(books[0]?.id ?? 0);
  const [newChapter, setNewChapter] = useState(1);
  const [newVerse, setNewVerse] = useState(1);
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Build book name map
  const bookMap = new Map(books.map((b) => [b.id, b.name]));

  // ── Actions ────────────────────────────────────────

  const handleDelete = async (id: number) => {
    if (!confirm("删除这条笔记？")) return;
    await fetch(`/api/note?id=${id}`, { method: "DELETE" });
    window.location.reload();
  };

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      // Calculate verseId using seed convention
      const verseId = newBookId * 100000 + newChapter * 1000 + newVerse;
      await fetch("/api/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseId, content: newContent.trim() }),
      });
      window.location.reload();
    } catch {
      alert("创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editNote || !newContent.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/note", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editNote.id, content: newContent.trim() }),
      });
      window.location.reload();
    } catch {
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditNote(null);
    setNewBookId(books[0]?.id ?? 0);
    setNewChapter(1);
    setNewVerse(1);
    setNewContent("");
    setShowCreate(true);
  };

  const openEdit = (note: NoteData & { verse: VerseData }) => {
    setEditNote(note);
    setNewBookId(note.verse?.bookId ?? books[0]?.id ?? 0);
    setNewChapter(note.verse?.chapter ?? 1);
    setNewVerse(note.verse?.verse ?? 1);
    setNewContent(note.content);
    setShowCreate(true);
  };

  // ── Render ─────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          笔记 {notes.length > 0 && <span className="text-muted-foreground text-lg">({notes.length})</span>}
        </h1>
        <Button variant="outline" size="sm" onClick={openCreate}>
          新建笔记
        </Button>
      </div>

      {notes.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-4xl opacity-30">&#128221;</p>
          <p className="text-muted-foreground">还没有笔记</p>
          <p className="text-xs text-muted-foreground">
            在学习和复习过程中可以添加笔记
          </p>
          <Button variant="outline" size="sm" onClick={openCreate}>
            写第一条笔记
          </Button>
        </div>
      )}

      {notes.map((note) => {
        const bookName = bookMap.get(note.verse?.bookId ?? 0);
        return (
          <Card key={note.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {bookName ? bookName : `书卷#${note.verse?.bookId}`}{" "}
                {note.verse?.chapter}:{note.verse?.verse}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleDateString("zh-CN")}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(note)}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(note.id)}>
                    删除
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editNote ? "编辑笔记" : "新建笔记"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Verse selector */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">书卷</Label>
                <select
                  className="w-full px-2 py-1.5 border rounded-md bg-background text-sm"
                  value={newBookId}
                  onChange={(e) => setNewBookId(parseInt(e.target.value))}
                  disabled={!!editNote}
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">章</Label>
                <Input
                  type="number"
                  min={1}
                  value={newChapter}
                  onChange={(e) => setNewChapter(parseInt(e.target.value) || 1)}
                  disabled={!!editNote}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">节</Label>
                <Input
                  type="number"
                  min={1}
                  value={newVerse}
                  onChange={(e) => setNewVerse(parseInt(e.target.value) || 1)}
                  disabled={!!editNote}
                  className="h-9"
                />
              </div>
            </div>

            {/* Content */}
            <div>
              <Label className="text-xs">内容</Label>
              <textarea
                className="w-full min-h-24 px-3 py-2 border rounded-md bg-background text-sm resize-none"
                placeholder="笔记内容..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                autoFocus
              />
            </div>

            <Button
              className="w-full"
              onClick={editNote ? handleEdit : handleCreate}
              disabled={saving || !newContent.trim()}
            >
              {saving ? "保存中..." : editNote ? "保存修改" : "创建笔记"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
