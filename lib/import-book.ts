/**
 * 按需从 data/bible.db 导入书卷到 prisma/dev.db
 * 用于创建计划时的增量导入
 */
import { prisma } from "./prisma";
import { resolve } from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite");

const BIBLE_DB = resolve(process.cwd(), "data/bible.db");
const KJV_DB = resolve(process.cwd(), "data/bible_kjv.db");

// 缓存 bible.db 连接（进程生命周期内复用）
let bibleDb: InstanceType<typeof DatabaseSync> | null = null;
let kjvDb: InstanceType<typeof DatabaseSync> | null = null;

function getBibleDb() {
  if (!bibleDb) bibleDb = new DatabaseSync(BIBLE_DB, { readonly: true });
  return bibleDb;
}

function getKjvDb() {
  if (!kjvDb) {
    try { kjvDb = new DatabaseSync(KJV_DB, { readonly: true }); }
    catch { return null; }
  }
  return kjvDb;
}

// ── 获取全本 66 卷列表 ────────────────────────────
export interface BookListItem {
  id: number;
  name: string;
  chapters: number;
  imported: boolean; // 是否已在本地 DB 中
}

export function getAllBookList(): BookListItem[] {
  const bible = getBibleDb();
  const rows = bible.prepare(
    "SELECT book_index, name FROM book_name ORDER BY book_index"
  ).all() as { book_index: number; name: string }[];

  return rows.map((r) => {
    const chapters = bible.prepare(
      "SELECT COUNT(DISTINCT chapter) AS c FROM content WHERE book_index = ? AND flag = 0"
    ).get(r.book_index) as { c: number };
    return { id: r.book_index, name: r.name, chapters: chapters.c, imported: false };
  });
}

// ── 检查书卷是否已导入 ────────────────────────────
export async function isBookImported(bookIndex: number): Promise<boolean> {
  const count = await prisma.book.count({ where: { id: bookIndex } });
  return count > 0;
}

// ── 按需导入单个书卷 ──────────────────────────────
export async function importBookIfNeeded(bookIndex: number): Promise<boolean> {
  if (await isBookImported(bookIndex)) return false; // 已存在，跳过

  const bible = getBibleDb();
  const kjv = getKjvDb();

  // 书卷名称
  const bookRow = bible.prepare(
    "SELECT name FROM book_name WHERE book_index = ?"
  ).get(bookIndex) as { name: string } | undefined;

  if (!bookRow) throw new Error(`书卷索引 ${bookIndex} 不存在`);

  // 经文
  const verses = bible.prepare(
    "SELECT chapter, section, content FROM content WHERE book_index = ? AND flag = 0 ORDER BY chapter, section"
  ).all(bookIndex) as { chapter: number; section: number; content: string }[];

  const chapterSet = new Set<number>();
  for (const v of verses) chapterSet.add(v.chapter);

  console.log(`Importing ${bookRow.name} (${verses.length} verses, ${chapterSet.size} chapters)...`);

  // 创建 Book
  await prisma.book.create({
    data: { id: bookIndex, name: bookRow.name, chapters: chapterSet.size },
  });

  // KJV 匹配
  let kjvVerses: Map<string, string> = new Map();
  if (kjv) {
    try {
      const kjvBook = kjv.prepare(
        "SELECT engs FROM main WHERE id = ?"
      ).get(bookIndex) as { engs: string } | undefined;
      if (kjvBook) {
        const rows = kjv.prepare(
          "SELECT chap, sec, txt FROM nstrkjv WHERE engs = ? ORDER BY chap, sec"
        ).all(kjvBook.engs) as { chap: number; sec: number; txt: string }[];
        for (const r of rows) kjvVerses.set(`${r.chap}:${r.sec}`, r.txt);
      }
    } catch { /* OK */ }
  }

  // 批量插入经文
  for (const v of verses) {
    const id = bookIndex * 100000 + v.chapter * 1000 + v.section;
    const kjvText = kjvVerses.get(`${v.chapter}:${v.section}`) || null;
    await prisma.verse.create({
      data: { id, bookId: bookIndex, chapter: v.chapter, verse: v.section, content: v.content, kjv: kjvText },
    });
  }

  // 注解
  const verseKeys = new Set<string>();

  const outlines = bible.prepare(
    "SELECT chapter, section, level, outline FROM outline WHERE book_index = ? AND flag = 0 ORDER BY chapter, section, level"
  ).all(bookIndex) as { chapter: number; section: number; level: number; outline: string }[];

  const outlineMap = new Map<string, { level: number; content: string }[]>();
  for (const o of outlines) {
    const key = `${o.chapter}:${o.section}`;
    if (!outlineMap.has(key)) outlineMap.set(key, []);
    outlineMap.get(key)!.push({ level: o.level, content: o.outline });
    verseKeys.add(key);
  }

  const footnotes = bible.prepare(
    "SELECT chapter, section, seq, note FROM footnote WHERE book_index = ? AND flag = 0 ORDER BY chapter, section, seq"
  ).all(bookIndex) as { chapter: number; section: number; seq: number; note: string }[];

  const footnoteMap = new Map<string, { seq: number; content: string }[]>();
  for (const f of footnotes) {
    const key = `${f.chapter}:${f.section}`;
    if (!footnoteMap.has(key)) footnoteMap.set(key, []);
    footnoteMap.get(key)!.push({ seq: f.seq, content: f.note });
    verseKeys.add(key);
  }

  const beads = bible.prepare(
    "SELECT chapter, section, seq, bead FROM bead WHERE book_index = ? AND flag = 0 ORDER BY chapter, section, seq"
  ).all(bookIndex) as { chapter: number; section: number; seq: string; bead: string }[];

  const beadMap = new Map<string, { ref: string; content: string }[]>();
  for (const b of beads) {
    const key = `${b.chapter}:${b.section}`;
    if (!beadMap.has(key)) beadMap.set(key, []);
    beadMap.get(key)!.push({ ref: b.seq, content: b.bead });
    verseKeys.add(key);
  }

  let annCount = 0;
  for (const key of verseKeys) {
    const [ch, sec] = key.split(":").map(Number);
    const verseId = bookIndex * 100000 + ch * 1000 + sec;
    const outlineJson = outlineMap.get(key)?.length ? JSON.stringify(outlineMap.get(key)) : null;
    const footnoteJson = footnoteMap.get(key)?.length ? JSON.stringify(footnoteMap.get(key)) : null;
    const beadJson = beadMap.get(key)?.length ? JSON.stringify(beadMap.get(key)) : null;
    if (outlineJson || footnoteJson || beadJson) {
      await prisma.annotation.upsert({
        where: { verseId },
        create: { verseId, outline: outlineJson, footnote: footnoteJson, crossref: beadJson },
        update: {},
      });
      annCount++;
    }
  }

  console.log(`  ${verses.length} verses, ${annCount} annotated`);
  return true;
}
