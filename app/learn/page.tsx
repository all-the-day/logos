import * as learnService from "@/services/learn";
import LearnClient from "./LearnClient";

export default async function LearnPage() {
  const result = await learnService.getTodayTasks();

  return (
    <LearnClient
      plan={result.plan ? JSON.parse(JSON.stringify(result.plan)) : null}
      tasks={JSON.parse(JSON.stringify(result.tasks))}
    />
  );
}
