import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const dups = await p.$queryRawUnsafe<any[]>(
    `SELECT verseId, COUNT(*) as n FROM Card GROUP BY verseId HAVING n > 1`
  );
  const total = await p.card.count();
  const verses = await p.$queryRawUnsafe<any[]>(
    `SELECT COUNT(DISTINCT verseId) as v FROM Card`
  );
  console.log("total cards:", total);
  console.log("distinct verses:", JSON.stringify(verses));
  console.log("duplicates:", dups.length);
  if (dups.length > 0) {
    console.log("first 5 dups:", JSON.stringify(dups.slice(0, 5)));
  }
  await p.$disconnect();
})();
