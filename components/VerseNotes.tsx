"use client";

import { useState, useEffect } from "react";

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

  useEffect(() => {
    setLoading(true);
    fetch(`/api/note?verseId=${verseId}`)
      .then((r) => r.json())
      .then((data) => setNotes(data.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [verseId]);

  if (loading) return null;

  if (notes.length === 0) return null;

  return (
    <details className="group">
      <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
        笔记 ({notes.length})
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
      </div>
    </details>
  );
}
