import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import * as learnService from "@/services/learn";
import { requireUser } from "@/lib/auth";
import LearnClient from "./LearnClient";

export const metadata: Metadata = {
  title: "学习 - Logos",
};

export default async function LearnPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const result = await learnService.getTodayTasks(user.id);

  return (
    <LearnClient
      plan={result.plan ? JSON.parse(JSON.stringify(result.plan)) : null}
      tasks={JSON.parse(JSON.stringify(result.tasks))}
      // 语音入口暂时隐藏（2026-10-24）：聚焦输入框拉起输入法即可用其自带语音输入；
      // ASR 代码链路保留，恢复时改回 isAsrEnabled()（lib/asr/config）
      asrEnabled={false}
    />
  );
}
