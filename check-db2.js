const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasourceUrl: "file:/root/logos/prisma/dev.db" });
(async () => {
  try {
    const tables = await p.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log("TABLES:", JSON.stringify(tables));
    const cols = await p.$queryRawUnsafe("PRAGMA table_info(Card)");
    console.log("CARD:", JSON.stringify(cols));
  } catch (e) {
    console.error("ERR:", e.message);
  } finally {
    await p.$disconnect();
  }
})();
