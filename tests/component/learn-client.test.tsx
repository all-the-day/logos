// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import LearnClient from "@/app/learn/LearnClient";
import type { PlanInfo, TaskData } from "@/types";

// vitest 未开 globals，testing-library 不会自动清理 DOM，需手动 cleanup 防跨用例污染
afterEach(cleanup);

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

  it("最后一节完成：点「完成」进入「今日任务已完成」空状态（回归 #1）", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    // 任务 1（复习卡）：背诵 → 提交 → 评分 → 下一节
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经文");
    await user.keyboard("{Enter}");
    await user.keyboard("3");
    await screen.findByRole("button", { name: /下一节/ });
    await user.click(screen.getByRole("button", { name: /下一节/ }));

    // 任务 2（新卡）：查看 → 开始背诵 → 提交 → 评分 → 此时按钮应为「完成」
    await user.click(screen.getByRole("button", { name: /开始背诵/ }));
    const textarea2 = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea2, "第二节经文");
    await user.keyboard("{Enter}");
    await user.keyboard("3");
    const doneBtn = await screen.findByRole("button", { name: /完成/ });
    await user.click(doneBtn);

    // 关键断言（修复点）：全部任务完成后显示完成空状态，而不是无反应
    expect(screen.getByText("今日任务已完成！")).toBeInTheDocument();
  });

  it("会话内重学：没到 100% 评 GOOD 也不能过，卡片插回队列尾部，重出时标「重学」", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    // 任务 1（复习卡）：只背出 4/5 字（漏了"文"），准确率 80% < 100%
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经");
    await user.keyboard("{Enter}");
    expect(screen.getByText("准确率 80%")).toBeInTheDocument();

    // 即使自评 GOOD，客观没到 100% 仍判定没过 → 插回队列尾部
    await user.keyboard("3");
    await screen.findByRole("button", { name: /下一节/ });
    await user.click(screen.getByRole("button", { name: /下一节/ }));

    // 任务 2（新卡）：正常通过
    await user.click(screen.getByRole("button", { name: /开始背诵/ }));
    const textarea2 = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea2, "第二节经文");
    await user.keyboard("{Enter}");
    await user.keyboard("3");
    await screen.findByRole("button", { name: /下一节/ });
    await user.click(screen.getByRole("button", { name: /下一节/ }));

    // 第 1 节的重出副本出现：标「重学」，直接进入背诵态
    expect(screen.getByText("重学")).toBeInTheDocument();
    const textarea3 = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea3, "第一节经文");
    await user.keyboard("{Enter}");
    expect(screen.getByText("准确率 100%")).toBeInTheDocument();
    await user.keyboard("3");

    // 这次 100% 过了 → 完成
    const doneBtn = await screen.findByRole("button", { name: /完成/ });
    await user.click(doneBtn);
    expect(screen.getByText("今日任务已完成！")).toBeInTheDocument();
  });

  it("会话内重学上限：同一节连续 AGAIN 3 次后不再重出，直接完成", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    // 任务 1（复习卡）：背错 → AGAIN → 重出副本 1
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经");
    await user.keyboard("{Enter}");
    await user.keyboard("1");
    await screen.findByRole("button", { name: /下一节/ });
    await user.click(screen.getByRole("button", { name: /下一节/ }));

    // 任务 2（新卡）：正常通过
    await user.click(screen.getByRole("button", { name: /开始背诵/ }));
    const textarea2 = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea2, "第二节经文");
    await user.keyboard("{Enter}");
    await user.keyboard("3");
    await screen.findByRole("button", { name: /下一节/ });
    await user.click(screen.getByRole("button", { name: /下一节/ }));

    // 重出副本 1：又背错 → AGAIN → 重出副本 2
    const textarea3 = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea3, "第一节经");
    await user.keyboard("{Enter}");
    await user.keyboard("1");
    await screen.findByRole("button", { name: /下一节/ });
    await user.click(screen.getByRole("button", { name: /下一节/ }));

    // 重出副本 2：再背错 → AGAIN → 已达上限（2 次），不再重出 → 按钮为「完成」
    const textarea4 = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea4, "第一节经");
    await user.keyboard("{Enter}");
    await user.keyboard("1");
    const doneBtn = await screen.findByRole("button", { name: /完成/ });
    await user.click(doneBtn);
    expect(screen.getByText("今日任务已完成！")).toBeInTheDocument();
  });
});
