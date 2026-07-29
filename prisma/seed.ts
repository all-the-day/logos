/**
 * 将 public/data/ 中的经文 JSON 导入 SQLite 数据库
 * 用法：npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import { readdirSync, readFileSync } from "fs";
import { resolve, join } from "path";

const prisma = new PrismaClient();

interface VerseItem {
  section: number;
  content: string;
  kjv?: string;
}

interface ChapterData {
  chapter: number;
  verses: VerseItem[];
}

interface VerseFile {
  book: string;
  book_index: number;
  total_verses: number;
  total_chapters: number;
  chapters: ChapterData[];
}

interface AnnotationEntry {
  [key: string]: Array<{ content?: string; ref?: string }>;
}

interface AnnotationFile {
  outlines?: AnnotationEntry;
  footnotes?: AnnotationEntry;
  beads?: AnnotationEntry;
}

async function main() {
  const dataDir = resolve(__dirname, "../data");
  let files: string[];
  try {
    files = readdirSync(dataDir).filter(
      (f) => /^\d+-.+\.json$/.test(f) && !f.includes("-annotations")
    );
  } catch {
    console.log("No data directory. Run extract-verses first.");
    return;
  }
  }

  if (files.length === 0) {
    console.log("No verse JSON files found in public/data/");
    return;
  }

  const existing = await prisma.book.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} books. Skipping.`);
    console.log("To reset: delete prisma/dev.db and re-run.");
    return;
  }

  for (const file of files) {
    const raw = readFileSync(join(dataDir, file), "utf-8");
    const data: VerseFile = JSON.parse(raw);

    console.log(`Importing ${data.book} (${data.total_verses} verses)...`);

    // Create book
    await prisma.book.create({
      data: {
        id: data.book_index,
        name: data.book,
        chapters: data.total_chapters,
      },
    });

    // Create verses
    for (const ch of data.chapters) {
      for (const v of ch.verses) {
        // Use book_index * 100000 + chapter * 1000 + section as verse ID
        const id =
          data.book_index * 100000 + ch.chapter * 1000 + v.section;
        await prisma.verse.create({
          data: {
            id,
            bookId: data.book_index,
            chapter: ch.chapter,
            verse: v.section,
            content: v.content,
            kjv: v.kjv || null,
          },
        });
      }
    }

    // Load annotations if available
    const annFile = file.replace(".json", "-annotations.json");
    try {
      const annRaw = readFileSync(join(dataDir, annFile), "utf-8");
      const ann: AnnotationFile = JSON.parse(annRaw);

      // Process outlines, footnotes, beads
      const allVerseKeys = new Set<string>();
      if (ann.outlines) Object.keys(ann.outlines).forEach((k) => allVerseKeys.add(k));
      if (ann.footnotes) Object.keys(ann.footnotes).forEach((k) => allVerseKeys.add(k));
      if (ann.beads) Object.keys(ann.beads).forEach((k) => allVerseKeys.add(k));

      for (const key of allVerseKeys) {
        const [chStr, secStr] = key.split(":");
        const chapter = parseInt(chStr);
        const section = parseInt(secStr);
        const verseId =
          data.book_index * 100000 + chapter * 1000 + section;

        const outlines = ann.outlines?.[key];
        const footnotes = ann.footnotes?.[key];
        const beads = ann.beads?.[key];

        // Serialize arrays to JSON strings
        const outlineJson = outlines ? JSON.stringify(outlines) : null;
        const footnoteJson = footnotes ? JSON.stringify(footnotes) : null;
        const crossrefJson = beads ? JSON.stringify(beads) : null;

        if (outlineJson || footnoteJson || crossrefJson) {
          await prisma.annotation.upsert({
            where: { verseId },
            create: {
              verseId,
              outline: outlineJson,
              footnote: footnoteJson,
              crossref: crossrefJson,
            },
            update: {},
          });
        }
      }
      console.log(`  Annotations imported for ${data.book}`);
    } catch {
      // No annotations file or error reading it
    }
  }

  console.log(`Done! Imported ${files.length} books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
