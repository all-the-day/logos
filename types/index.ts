// Book & Verse
export interface BookInfo {
  id: number;
  name: string;
  chapters: number;
}

export interface VerseData {
  id: number;
  bookId: number;
  chapter: number;
  verse: number;
  content: string;
  kjv: string | null;
}

// Plan
export interface PlanInfo {
  id: number;
  bookId: number;
  versesPerDay: number;
  startDate: Date;
  status: string;
}

export interface CardProgress {
  total: number;
  mastered: number;
  learning: number;
  new: number;
}

// Card
export interface CardData {
  id: number;
  verseId: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: string;
  lastReview: Date | null;
  due: Date;
  verse?: VerseData;
}

// Note
export interface NoteData {
  id: number;
  verseId: number;
  content: string;
  createdAt: Date;
  verse?: VerseData;
}

// Checkin
export interface CheckinData {
  id: number;
  date: string;
  verseText: string | null;
  createdAt: Date;
}

// Annotation
export interface AnnotationData {
  outline?: string;
  footnote?: string;
  crossref?: string;
}

// Daily verse
export interface DailyVerse {
  book: string;
  chapter: number;
  section: number;
  content: string;
  kjv: string;
  reference: string;
}
