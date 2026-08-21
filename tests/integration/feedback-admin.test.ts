import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clearDb } from "@/tests/fixtures/seed-test";
import {
  createFeedback,
  getAllFeedback,
  getAllFeedbackForAdmin,
  updateFeedbackStatus,
  updateFeedbackStatusAdmin,
} from "@/db/feedback";

async function seed() {
  await clearDb();
  await prisma.user.create({
    data: { id: 1, username: "alice", name: "爱丽丝", passwordHash: "x" },
  });
  await prisma.user.create({
    data: { id: 2, username: "bob", name: "鲍勃", passwordHash: "x" },
  });
}

describe("feedback admin 分支", () => {
  beforeEach(seed);

  it("getAllFeedbackForAdmin 返回全部反馈并附带提交人", async () => {
    await createFeedback(1, "bug", "复习卡不见了");
    await createFeedback(2, "suggestion", "想要夜间模式");
    const all = await getAllFeedbackForAdmin();
    expect(all).toHaveLength(2);
    expect(all[0].user?.username).toBe("bob");
    expect(all[0].content).toBe("想要夜间模式");
  });

  it("getAllFeedback 仍按用户隔离", async () => {
    await createFeedback(1, "bug", "alice 的 bug");
    await createFeedback(2, "bug", "bob 的 bug");
    expect(await getAllFeedback(1)).toHaveLength(1);
    expect(await getAllFeedback(2)).toHaveLength(1);
  });

  it("updateFeedbackStatusAdmin 可跨用户更新", async () => {
    const f = await createFeedback(1, "other", "alice 的反馈");
    const r = await updateFeedbackStatusAdmin(f.id, "resolved");
    expect(r.count).toBe(1);
    const row = await prisma.feedback.findUniqueOrThrow({ where: { id: f.id } });
    expect(row.status).toBe("resolved");
  });

  it("updateFeedbackStatus 不能跨用户更新（隔离）", async () => {
    const f = await createFeedback(1, "other", "alice 的反馈");
    const r = await updateFeedbackStatus(f.id, 2, "resolved");
    expect(r.count).toBe(0);
  });
});
