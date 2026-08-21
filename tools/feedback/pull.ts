// tools/feedback/pull.ts — 拉取线上反馈，生成收件箱 markdown
// 用法: npm run feedback:pull [--all]   （--all 包含已处理）
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { API_BASE, loadEnv, login, type Feedback } from "./lib";

const OUT = resolve(process.cwd(), "tools/feedback/inbox.md");

async function main() {
  loadEnv();
  const cookie = await login();

  const onlyOpen = !process.argv.includes("--all");
  const res = await fetch(`${API_BASE}/api/feedback`, { headers: { cookie } });
  if (!res.ok) throw new Error(`获取反馈失败 ${res.status}: ${await res.text()}`);
  const { feedback } = (await res.json()) as { feedback: Feedback[] };

  const list = onlyOpen ? feedback.filter((f) => f.status === "open") : feedback;
  const lines: string[] = [];
  lines.push("# 反馈收件箱");
  lines.push(`> 生成时间：${new Date().toLocaleString("zh-CN")} · 来源：${API_BASE}`);
  lines.push(`> 当前 ${list.length} 条（${onlyOpen ? "open，全部 " + feedback.length : "含已处理"} 条）`);
  lines.push("");
  lines.push("## 待处理");
  lines.push("");
  for (const f of list) {
    if (!onlyOpen && f.status !== "open") continue;
    lines.push(...formatItem(f));
  }
  if (onlyOpen) {
    const done = feedback.filter((f) => f.status !== "open");
    lines.push("## 已处理");
    lines.push("");
    for (const f of done) lines.push(...formatItem(f));
  }
  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`已写入 ${OUT}（${list.length} 条）`);
}

function formatItem(f: Feedback): string[] {
  const who = f.user ? `${f.user.name}（@${f.user.username}）` : "#" + f.id;
  const tag = f.type === "bug" ? "BUG" : f.type === "suggestion" ? "建议" : "其他";
  return [
    `### #${f.id} [${tag}] ${who} — ${f.createdAt}（${f.status}）`,
    "",
    f.content,
    "",
    `> 处理：\`npm run feedback:close ${f.id}\``,
    "",
  ];
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
