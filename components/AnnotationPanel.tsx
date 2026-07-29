"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface AnnotationData {
  outline?: string | null;
  footnote?: string | null;
  crossref?: string | null;
}

interface OutlineItem {
  level?: number;
  title?: string;
  content?: string;
  ref?: string;
}

interface FootnoteItem {
  seq?: number;
  content?: string;
  ref?: string;
}

interface CrossrefItem {
  content?: string;
  ref?: string;
}

interface Props {
  verseId: number;
}

export default function AnnotationPanel({ verseId }: Props) {
  const [annotation, setAnnotation] = useState<AnnotationData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/annotation?verseId=${verseId}`)
      .then((r) => r.json())
      .then((data) => setAnnotation(data.annotation))
      .catch(() => setAnnotation(null))
      .finally(() => setLoading(false));
  }, [verseId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">加载注解...</p>
        </CardContent>
      </Card>
    );
  }

  if (!annotation || (!annotation.outline && !annotation.footnote && !annotation.crossref)) {
    return null;
  }

  return (
    <div className="space-y-2">
      {annotation.outline && <OutlineSection json={annotation.outline} />}
      {annotation.footnote && <FootnoteSection json={annotation.footnote} />}
      {annotation.crossref && <CrossrefSection json={annotation.crossref} />}
    </div>
  );
}

function OutlineSection({ json }: { json: string }) {
  let items: OutlineItem[] = [];
  try {
    items = JSON.parse(json);
  } catch {
    return null;
  }

  if (!items.length) return null;

  return (
    <details className="group" open>
      <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
        纲目 ({items.length})
      </summary>
      <div className="mt-2 space-y-0.5">
        {items.map((item, i) => (
          <div
            key={i}
            className="text-sm"
            style={{ paddingLeft: `${((item.level || 0) - 1) * 16}px` }}
          >
            {item.ref && (
              <span className="text-xs text-muted-foreground mr-1">
                {item.ref}
              </span>
            )}
            {item.title || item.content}
          </div>
        ))}
      </div>
    </details>
  );
}

function normalizeToGroups<T>(parsed: unknown): Record<string, T[]> {
  if (Array.isArray(parsed)) {
    return { "": parsed as T[] };
  }
  if (parsed && typeof parsed === "object") {
    const result: Record<string, T[]> = {};
    for (const [key, val] of Object.entries(parsed)) {
      result[key] = Array.isArray(val) ? val : [];
    }
    return result;
  }
  return {};
}

function FootnoteSection({ json }: { json: string }) {
  let items: Record<string, FootnoteItem[]>;
  try {
    items = normalizeToGroups<FootnoteItem>(JSON.parse(json));
  } catch {
    return null;
  }

  const entries = Object.entries(items);
  if (!entries.length) return null;

  let total = 0;
  for (const [, v] of entries) total += v.length;

  return (
    <details className="group">
      <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
        注解 ({total})
      </summary>
      <div className="mt-2 space-y-1.5">
        {entries.map(([key, arr]) =>
          arr.map((item, i) => (
            <div key={`${key}-${i}`} className="text-sm flex gap-2">
              <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                {item.seq}
              </span>
              <span>{item.content}</span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

function CrossrefSection({ json }: { json: string }) {
  let items: Record<string, CrossrefItem[]>;
  try {
    items = normalizeToGroups<CrossrefItem>(JSON.parse(json));
  } catch {
    return null;
  }

  const entries = Object.entries(items);
  if (!entries.length) return null;

  let total = 0;
  for (const [, v] of entries) total += v.length;

  return (
    <details className="group">
      <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
        串珠 ({total})
      </summary>
      <div className="mt-2 space-y-1">
        {entries.map(([key, arr]) =>
          arr.map((item, i) => (
            <div key={`${key}-${i}`} className="text-sm flex gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                {item.ref}
              </span>
              <span>{item.content}</span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
