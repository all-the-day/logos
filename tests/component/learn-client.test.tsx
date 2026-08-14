// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import LearnClient from "@/app/learn/LearnClient";
import type { PlanInfo, TaskData } from "@/types";

// next/link 在 jsdom 下需要 router 上下文，mock 成普通 <a>
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", props, children),
}));

const plan: PlanInfo = { id: 1, bookId: 1, versesPerDay: 2, startDate: new Date(), status: "active" };

function makeTask(overrides: Partial<TaskData>): TaskData {
  return {
    id: 0, bookId: 1, chapter: 1, verse: 0, content: "", kjv: null,
    cardId: 0, cardState: "new", cardStability: 2, cardDifficulty: 5,
    cardReps: 0, cardLapses: 0, cardLastReview: null, cardDue: new Date(),
    ...overrides,
  };
}

const tasks: TaskData[] = [
  makeTask({ id: 101, chapter: 1, verse: 1, content: "第一节经文", cardId: 1, cardState: "review", cardStability: 5, cardReps: 3 }),
  makeTask({ id: 102, chapter: 1, verse: 2, content: "第二节经文", cardId: 2, cardState: "new" }),
];

describe("LearnClient 跨节状态隔离（复现：上一节的输入/比对残留到下一节）", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).startsWith("/api/card")) {
        return { ok: true, status: 200, json: async () => ({ card: { id: 1 }, nextInterval: 1 }) };
      }
      if (String(url).startsWith("/api/annotation")) {
        return { ok: true, status: 200, json: async () => ({ annotation: null }) };
      }
      if (String(url).startsWith("/api/note")) {
        return { ok: true, status: 200, json: async () => ({ notes: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }));
  });

  it("上一节提交/评分后切到下一节：输入框清空，误用旧文提交不会按旧节判 100%", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    // 第一个任务是复习卡 → 直接进入背诵态，输入框为空
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");

    // 输入第一节并提交 → 与本节一致，判 100%
    await user.type(textarea, "第一节经文");
    await user.keyboard("{Enter}");
    expect(screen.getByText("准确率 100%")).toBeInTheDocument();

    // 评分成功 → 出现"下一节"
    await user.keyboard("3");
    await screen.findByRole("button", { name: /下一节/ });
    await user.click(screen.getByRole("button", { name: /下一节/ }));

    // 第二个任务是新卡 → 查看态 → 开始背诵
    await user.click(screen.getByRole("button", { name: /开始背诵/ }));

    // 关键断言（修复点）：进入下一节背诵态时输入框为空，不残留第一节内容
    const textarea2 = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    expect(textarea2.value).toBe("");

    // 用户仍按上一节的记忆输入并提交 → 不应判 100%，比对目标应为第二节
    await user.type(textarea2, "第一节经文");
    await user.keyboard("{Enter}");

    // 结果页"原文"是第二节，且准确率不是 100%
    expect(screen.getByText("第二节经文")).toBeInTheDocument();
    expect(screen.getByText(/准确率 (?!100%)/)).toBeInTheDocument();
  });
});
