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
    />
  );
}
