// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import LearnClient from "@/app/learn/LearnClient";
import type { PlanInfo, TaskData } from "@/types";

afterEach(cleanup);

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", props, children),
}));

const plan: PlanInfo = {
  id: 1,
  bookId: 1,
  versesPerDay: 5,
  reciteMode: "passage",
  passageSize: 5,
  startDate: new Date(),
  status: "active",
};

function makeTask(overrides: Partial<TaskData>): TaskData {
  return {
    id: 0,
    bookId: 1,
    bookName: "罗马书",
    chapter: 1,
    verse: 1,
    content: "",
    kjv: null,
    cardId: 1,
    cardState: "new",
    cardStability: 2,
    cardDifficulty: 5,
    cardReps: 0,
    cardLapses: 0,
    cardLastReview: null,
    cardDue: new Date(),
    ...overrides,
  };
}

describe("LearnClient 连背模式", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).startsWith("/api/card")) {
          return { ok: true, status: 200, json: async () => ({ cards: [{ id: 1, state: "learning" }] }) };
        }
        if (String(url).startsWith("/api/note")) {
          return { ok: true, status: 200, json: async () => ({ notes: [] }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      })
    );
  });

  it("连背任务显示经节区间与组大小，提交后一组一评批量写入", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({
        id: 101,
        verse: 1,
        verseEnd: 2,
        content: "第一节经文第二节经文",
        isPassage: true,
        cardIds: [1, 2],
        cardState: "review",
        passageVerses: [
          { verse: 1, content: "第一节经文" },
          { verse: 2, content: "第二节经文" },
        ],
      }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} />);

    // 顶栏与背诵卡头部都会显示经节区间
    expect(screen.getAllByText("罗马书 1:1-2").length).toBeGreaterThan(0);
    expect(screen.getByText("连背 2 节")).toBeInTheDocument();
    // 单项会话不显示进度行（通过与否由按钮语义色表达）
    expect(screen.queryByText(/首答 /)).not.toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经文第二节经文");
    await user.keyboard("{Enter}");
    expect(screen.getByText("准确率 100%")).toBeInTheDocument();

    // 结果页按节分行展示，并统计首答通过
    expect(screen.getByRole("button", { name: "通过，下一组" })).toBeInTheDocument();
    expect(screen.getByText("比对结果（按节）")).toBeInTheDocument();
    expect(screen.getAllByText(/罗马书 1:1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/罗马书 1:2/).length).toBeGreaterThan(0);

    // 通过后先不写库，点「下一组」才入库
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).startsWith("/api/card"))).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: /下一组/ }));

    const rateCall = fetchMock.mock.calls.find((call) => String(call[0]).startsWith("/api/card"));
    expect(rateCall).toBeTruthy();
    const body = JSON.parse(String((rateCall?.[1] as RequestInit).body));
    // 一次默对（100% → EASY），一组一评批量写入
    expect(body.ratings).toEqual([
      { cardId: 1, rating: 4 },
      { cardId: 2, rating: 4 },
    ]);
  });

  it("连背任务没有到 100% 也判定没过并重学", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({
        id: 101,
        verse: 1,
        verseEnd: 2,
        content: "第一节经文第二节经文",
        isPassage: true,
        cardIds: [1, 2],
        cardState: "review",
      }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} />);
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经文");
    await user.keyboard("{Enter}");
    expect(screen.getByText(/准确率 (?!100%)/)).toBeInTheDocument();
  });

  it("含新卡的混合组：先查看再背诵，未通过后原地重练同一组", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({
        id: 101,
        verse: 1,
        verseEnd: 5,
        content: "第一节经文第二节经文",
        isPassage: true,
        cardIds: [1, 2],
        cardState: "review",
        hasNew: true,
      }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} />);

    // 首次进入：混合组先看（只显示区间，不显示原文输入框）
    expect(screen.getByRole("heading", { name: "罗马书 1:1-5" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("在此输入经文...")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始背诵" }));

    // 背漏一节 → 未到 90%
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经文");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "未通过，重新练习" })).toBeInTheDocument();

    // 继续练习 → 还是同一组（1:1-5），直接进背诵态，输入框清空
    await user.click(await screen.findByRole("button", { name: /重新练习/ }));
    expect(screen.getByRole("heading", { name: "罗马书 1:1-5" })).toBeInTheDocument();
    expect((screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement).value).toBe("");
  });

});
