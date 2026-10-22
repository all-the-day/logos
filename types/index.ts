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

/** 卡片 FSRS 快照：撤销评分时按卡恢复（连背组内每张卡独立保存） */
export interface CardSnapshot {
  cardId: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: string;
  lastReview: Date | string | null;
  due: Date | string;
}

// 学习任务：verse 字段 + 卡片状态，供 UI 用
export interface TaskData extends VerseData {
  bookName: string;
  cardId: number;
  cardState: string;
  cardStability: number;
  cardDifficulty: number;
  cardReps: number;
  cardLapses: number;
  cardLastReview: Date | null;
  cardDue: Date;
  /** 会话内重出标记：AGAIN 评分后插回队列尾部的副本（仅客户端学习会话使用） */
  requeued?: boolean;
  /** 连背任务标记：content 为整段拼接原文，cardIds 为组内所有卡片 */
  isPassage?: boolean;
  verseEnd?: number;
  cardIds?: number[];
  /** 连背组内每张卡的独立快照（撤销用；单节任务为空） */
  passageCards?: CardSnapshot[];
}

// Plan
export interface PlanInfo {
  id: number;
  bookId: number;
  versesPerDay: number;
  reciteMode: "single" | "passage";
  passageSize: number;
  startDate: Date;
  status: string;
}

export interface CardProgress {
  total: number;
  mastered: number;
  learning: number;
  new: number;
}

/** 自由练习：用户指定书卷 + 章 + 节范围（不依赖计划） */
export interface PracticeRange {
  bookId: number;
  chapter: number;
  from: number;
  to: number;
  mode: "single" | "passage";
  passageSize: number;
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
