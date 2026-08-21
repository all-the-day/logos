// tools/feedback/close.ts — 标记反馈为已处理
// 用法: npm run feedback:close <id>
import { loadEnv, login } from "./lib";

async function main() {
  const id = process.argv[2];
  if (!id || !/^\d+$/.test(id)) {
    console.error("用法: npm run feedback:close <id>");
    process.exit(1);
  }
  loadEnv();
  const cookie = await login();
  const res = await fetch(`${process.env.LOGO_API_BASE ?? "https://logos.duoban.xyz"}/api/feedback`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ id: Number(id), status: "resolved" }),
  });
  if (!res.ok) throw new Error(`更新失败 ${res.status}: ${await res.text()}`);
  console.log(`反馈 #${id} 已标记为 resolved`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
