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

const plan: PlanInfo = {
  id: 1,
  bookId: 1,
  versesPerDay: 2,
  reciteMode: "single",
  passageSize: 5,
  startDate: new Date(),
  status: "active",
};

function makeTask(overrides: Partial<TaskData>): TaskData {
  return {
    id: 0, bookId: 1, bookName: "罗马书", chapter: 1, verse: 0, content: "", kjv: null,
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

  it("上一节通过并点「下一节」后切到下一节：输入框清空，误用旧文提交不会按旧节判 100%", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    // 第一个任务是复习卡 → 直接进入背诵态，输入框为空
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");

    // 输入第一节并提交 → 与本节一致，判 100%
    await user.type(textarea, "第一节经文");
    await user.keyboard("{Enter}");
    expect(screen.getByText("准确率 100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通过，下一节" })).toBeInTheDocument();

    // 通过后点「下一节」→ 入库并进入下一项
    await user.click(screen.getByRole("button", { name: /下一节/ }));
    await screen.findByRole("heading", { name: "罗马书 1:2" });

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

  it("最后一节通过后点「下一节」即结束（没有单独的「完成」按钮）", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    // 任务 1（复习卡）：通过 → 下一节
    await user.type(screen.getByPlaceholderText("在此输入经文..."), "第一节经文");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: /下一节/ }));
    await screen.findByRole("heading", { name: "罗马书 1:2" });

    // 任务 2（新卡）：查看 → 背诵 → 通过
    await user.click(screen.getByRole("button", { name: /开始背诵/ }));
    await user.type(screen.getByPlaceholderText("在此输入经文..."), "第二节经文");
    await user.keyboard("{Enter}");

    // 最后一项显示「完成学习」
    expect(screen.getByRole("button", { name: /完成学习/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /完成学习/ }));

    expect(await screen.findByText("今日任务已完成！")).toBeInTheDocument();
  });

  it("未通过：顶部只显示「重新练习」，点击后原地重背同一节", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    // 任务 1：只背出 4/5 字（漏了"文"），80% < 90%
    await user.type(screen.getByPlaceholderText("在此输入经文..."), "第一节经");
    await user.keyboard("{Enter}");
    expect(screen.getByText("准确率 80%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "未通过，重新练习" })).toBeInTheDocument();
    // 未通过没有「下一节」
    expect(screen.queryByRole("button", { name: /下一节/ })).not.toBeInTheDocument();

    // 重新练习 → 还是同一节，输入框清空
    await user.click(screen.getByRole("button", { name: /重新练习/ }));
    expect(screen.getByRole("heading", { name: "罗马书 1:1" })).toBeInTheDocument();
    const retryInput = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    expect(retryInput.value).toBe("");

    // 这次背对 → 通过，首答仍算未通过
    await user.type(retryInput, "第一节经文");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: "通过，下一节" })).toBeInTheDocument();
    expect(screen.getByText("首答通过 0")).toBeInTheDocument();
  });

  it("未通过可以一直原地重练，不限次数", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    for (let i = 0; i < 4; i++) {
      await user.type(screen.getByPlaceholderText("在此输入经文..."), "第一节经");
      await user.keyboard("{Enter}");
      await user.click(await screen.findByRole("button", { name: /重新练习/ }));
      expect(screen.getByRole("heading", { name: "罗马书 1:1" })).toBeInTheDocument();
    }
    expect(screen.getByPlaceholderText("在此输入经文...")).toBeInTheDocument();
  });

  it("通过后点「下一组」才入库：未通过不写分，补考通过封顶「正确」", async () => {
    const user = userEvent.setup();
    render(<LearnClient plan={plan} tasks={tasks} />);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const rateCalls = () =>
      fetchMock.mock.calls.filter(
        (call) => String(call[0]) === "/api/card" && String((call[1] as RequestInit)?.method) === "POST"
      );

    // 先失败一次 → 提交时不写库
    await user.type(screen.getByPlaceholderText("在此输入经文..."), "第一节经");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "未通过，重新练习" })).toBeInTheDocument();
    expect(rateCalls()).toHaveLength(0);

    // 重新练习并背对 → 仍不写库，要点「下一节」才入库
    await user.click(screen.getByRole("button", { name: /重新练习/ }));
    await user.type(screen.getByPlaceholderText("在此输入经文..."), "第一节经文");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: "通过，下一节" })).toBeInTheDocument();
    expect(rateCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /下一节/ }));
    await screen.findByRole("heading", { name: "罗马书 1:2" });

    expect(rateCalls()).toHaveLength(1);
    const body = JSON.parse(String((rateCalls()[0][1] as RequestInit).body));
    // 补考通过：accuracy 100% 本应 EASY(4)，封顶为 GOOD(3)
    expect(body).toEqual({ cardId: 1, rating: 3 });
    // 首答未通过：计数不涨
    expect(screen.getByText("首答通过 0")).toBeInTheDocument();
  });
});
