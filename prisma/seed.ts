/**
 * 从 data/bible.db 导入经文到 prisma/dev.db
 * 用法：npx tsx prisma/seed.ts [书卷索引 ...]
 *   npx tsx prisma/seed.ts              # 默认导入当前配置的书卷
 *   npx tsx prisma/seed.ts 45 46 47     # 导入指定书卷
 */
import { PrismaClient } from "@prisma/client";
import { resolve } from "path";

// node:sqlite (Node 22.5+) experimental — dynamic require for tsx
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite");

const prisma = new PrismaClient();

// ── 配置：需要导入的书卷索引 ──────────────────────────
const DEFAULT_BOOKS = [45, 46, 47, 48, 49, 50, 51, 62];
// 45=罗马书 46=林前 47=林后 48=加拉太 49=以弗所 50=腓立比 51=歌罗西 62=约一

// ── 数据源路径 ───────────────────────────────────────
const BIBLE_DB = resolve(__dirname, "../data/bible.db");
const KJV_DB = resolve(__dirname, "../data/bible_kjv.db");

async function main() {
  const args = process.argv.slice(2);
  const bookIndexes = args.length > 0
    ? args.map(Number).filter((n) => !isNaN(n))
    : DEFAULT_BOOKS;

  // 打开中英文数据库
  const bible = new DatabaseSync(BIBLE_DB, { readonly: true });
  let kjv: typeof DatabaseSync | null = null;
  try {
    kjv = new DatabaseSync(KJV_DB, { readonly: true });
  } catch { /* KJV 库可能不存在 */ }

  const existing = await prisma.book.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} books. Skipping.`);
    console.log("To reset: delete prisma/dev.db and re-run.");
    bible.close();
    kjv?.close();
    return;
  }

  for (const bookIndex of bookIndexes) {
    // ── 书卷名称 ──
    const bookRow = bible.prepare(
      "SELECT name FROM book_name WHERE book_index = ?"
    ).get(bookIndex) as { name: string } | undefined;

    if (!bookRow) {
      console.log(`Book index ${bookIndex} not found, skipping.`);
      continue;
    }

    const bookName = bookRow.name;

    // ── 经文 ── (flag=0 为正文)
    const verses = bible.prepare(
      "SELECT chapter, section, content FROM content WHERE book_index = ? AND flag = 0 ORDER BY chapter, section"
    ).all(bookIndex) as { chapter: number; section: number; content: string }[];

    // 每章有多少节
    const chapterSet = new Set<number>();
    for (const v of verses) chapterSet.add(v.chapter);
    const totalChapters = chapterSet.size;

    console.log(`Importing ${bookName} (${verses.length} verses, ${totalChapters} chapters)...`);

    // 创建 Book
    await prisma.book.create({
      data: { id: bookIndex, name: bookName, chapters: totalChapters },
    });

    // 准备 KJV 数据
    let kjvVerses: Map<string, string> = new Map();
    if (kjv) {
      try {
        // KJV 使用 engs 缩写 (Rom, 1 Cor 等) 而非 book_index
        const kjvBook = kjv.prepare(
          "SELECT engs FROM main WHERE id = ?"
        ).get(bookIndex) as { engs: string } | undefined;

        if (kjvBook) {
          const rows = kjv.prepare(
            "SELECT chap, sec, txt FROM nstrkjv WHERE engs = ? ORDER BY chap, sec"
          ).all(kjvBook.engs) as { chap: number; sec: number; txt: string }[];
          for (const r of rows) {
            kjvVerses.set(`${r.chap}:${r.sec}`, r.txt);
          }
          console.log(`  KJV: ${rows.length} verses matched`);
        }
      } catch { /* KJV 读取失败继续 */ }
    }

    // 批量插入 Verse
    for (const v of verses) {
      const id = bookIndex * 100000 + v.chapter * 1000 + v.section;
      const kjvText = kjvVerses.get(`${v.chapter}:${v.section}`) || null;
      await prisma.verse.create({
        data: {
          id,
          bookId: bookIndex,
          chapter: v.chapter,
          verse: v.section,
          content: v.content,
          kjv: kjvText,
        },
      });
    }

    // ── 注解 ──
    // 收集所有有注解的经文
    const verseKeys = new Set<string>();

    // 纲目
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

    // 注解
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

    // 串珠
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

    // 插入注解
    let annCount = 0;
    for (const key of verseKeys) {
      const [ch, sec] = key.split(":").map(Number);
      const verseId = bookIndex * 100000 + ch * 1000 + sec;

      const outlineJson = outlineMap.get(key)?.length
        ? JSON.stringify(outlineMap.get(key))
        : null;
      const footnoteJson = footnoteMap.get(key)?.length
        ? JSON.stringify(footnoteMap.get(key))
        : null;
      const beadJson = beadMap.get(key)?.length
        ? JSON.stringify(beadMap.get(key))
        : null;

      if (outlineJson || footnoteJson || beadJson) {
        await prisma.annotation.upsert({
          where: { verseId },
          create: {
            verseId,
            outline: outlineJson,
            footnote: footnoteJson,
            crossref: beadJson,
          },
          update: {},
        });
        annCount++;
      }
    }

    console.log(`  Annotations: ${annCount} verses`);
  }

  bible.close();
  kjv?.close();
  console.log(`Done! Imported ${bookIndexes.length} books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
