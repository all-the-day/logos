import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import * as practiceService from "@/services/practice";
import { parsePracticeParams } from "@/lib/practice";
import * as planDb from "@/db/plan";
import * as verseDb from "@/db/verse";
import { requireUser } from "@/lib/auth";
import LearnClient from "../learn/LearnClient";
import PracticeSetupClient from "./PracticeSetupClient";
import type { BookInfo } from "@/types";

export const metadata: Metadata = {
  title: "自由练习 - Logos",
};

type SearchParams = Record<string, string | string[] | undefined>;

function num(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const plan = await planDb.getActivePlan(user.id);
  const books = JSON.parse(JSON.stringify(await verseDb.getAllBooks())) as BookInfo[];

  const setupProps = {
    books,
    defaultMode: (plan?.reciteMode === "passage" ? "passage" : "single") as
      | "single"
      | "passage",
    defaultPassageSize: plan?.passageSize ?? 5,
    defaultBookId: plan?.bookId ?? null,
  };
  const rawMode = Array.isArray(sp.mode) ? sp.mode[0] : sp.mode;
  const initial = {
    bookId: num(sp.bookId),
    chapter: num(sp.chapter),
    from: num(sp.from),
    to: num(sp.to),
    // 校验失败回到表单时保留刚才的连背选择
    mode: rawMode === "passage" ? ("passage" as const) : rawMode === "single" ? ("single" as const) : undefined,
    size: num(sp.size),
  };

  // 未带参数：显示经节选择表单
  if (sp.bookId === undefined) {
    return <PracticeSetupClient {...setupProps} />;
  }

  const parsed = parsePracticeParams(sp);
  if (!parsed.ok) {
    return <PracticeSetupClient {...setupProps} initial={initial} error={parsed.error} />;
  }

  const result = await practiceService.getPracticeTasks(user.id, parsed.range);
  if (!result.ok) {
    return <PracticeSetupClient {...setupProps} initial={initial} error={result.error} />;
  }

  return (
    <>
      <div className="max-w-lg mx-auto px-4 pt-3 flex items-center justify-between">
        <Link href="/practice" className="text-sm text-muted-foreground hover:text-foreground">
          ← 重新选择经节
        </Link>
        <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground">
          返回计划
        </Link>
      </div>
      <LearnClient
        plan={plan ? JSON.parse(JSON.stringify(plan)) : null}
        tasks={JSON.parse(JSON.stringify(result.tasks))}
        // 语音入口暂时隐藏（2026-10-24）：改用输入法自带语音输入；恢复时改回 isAsrEnabled()
        asrEnabled={false}
        practice
      />
    </>
  );
}
