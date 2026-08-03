/**
 * 从 data/bible.db 导入经文到 prisma/dev.db（复用 import-book 的导入逻辑）
 * 用法：npx tsx prisma/seed.ts [书卷索引 ...]
 *   npx tsx prisma/seed.ts              # 默认导入默认书卷
 *   npx tsx prisma/seed.ts 45 46 47     # 导入指定书卷
 */
import { importBookIfNeeded, isBookImported } from "../lib/import-book";

const DEFAULT_BOOKS = [45, 46, 47, 48, 49, 50, 51, 62];

async function main() {
  const args = process.argv.slice(2);
  const bookIndexes = args.length > 0
    ? args.map(Number).filter((n) => !isNaN(n))
    : DEFAULT_BOOKS;

  let imported = 0;
  for (const bookIndex of bookIndexes) {
    if (await isBookImported(bookIndex)) {
      console.log(`Book ${bookIndex} already imported, skipping.`);
      continue;
    }
    try {
      await importBookIfNeeded(bookIndex);
      imported++;
    } catch (e) {
      console.error(`Import ${bookIndex} failed:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done! Imported ${imported} books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
