// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
      }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} />);

    expect(screen.getByText("罗马书 1:1-2")).toBeInTheDocument();
    expect(screen.getByText("连背 2 节")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经文第二节经文");
    await user.keyboard("{Enter}");
    expect(screen.getByText("准确率 100%")).toBeInTheDocument();

    await user.keyboard("3");
    await screen.findByRole("button", { name: /下一组|完成/ });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const rateCall = fetchMock.mock.calls.find((call) => String(call[0]).startsWith("/api/card"));
    expect(rateCall).toBeTruthy();
    const body = JSON.parse(String((rateCall?.[1] as RequestInit).body));
    expect(body.ratings).toEqual([
      { cardId: 1, rating: 3 },
      { cardId: 2, rating: 3 },
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

  it("连背评分后撤销：按组内每张卡的独立快照恢复，不用第一节覆盖整组", async () => {
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
        cardStability: 2,
        cardDifficulty: 5,
        cardReps: 1,
        cardLapses: 0,
        cardLastReview: new Date("2026-01-01T00:00:00.000Z"),
        cardDue: new Date("2026-02-01T00:00:00.000Z"),
        passageCards: [
          {
            cardId: 1,
            stability: 2,
            difficulty: 5,
            reps: 1,
            lapses: 0,
            state: "review",
            lastReview: new Date("2026-01-01T00:00:00.000Z"),
            due: new Date("2026-02-01T00:00:00.000Z"),
          },
          {
            cardId: 2,
            stability: 9,
            difficulty: 8,
            reps: 4,
            lapses: 2,
            state: "review",
            lastReview: new Date("2026-03-01T00:00:00.000Z"),
            due: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
      }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} />);
    const textarea = screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement;
    await user.type(textarea, "第一节经文第二节经文");
    await user.keyboard("{Enter}");
    await user.keyboard("3"); // GOOD
    await screen.findByRole("button", { name: /下一组|完成/ });
    await user.keyboard("u"); // 撤销

    await waitFor(() => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      const putCall = fetchMock.mock.calls.find(
        (call) =>
          String(call[0]) === "/api/card" &&
          String((call[1] as RequestInit | undefined)?.method ?? "").toUpperCase() === "PUT"
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall?.[1] as RequestInit).body));
      // 每张卡恢复各自的快照（修复前：整组都被覆盖成第一节的数据，且字段名 id 导致 400）
      expect(body.cards).toHaveLength(2);
      expect(body.cards[0]).toMatchObject({ cardId: 1, stability: 2, difficulty: 5, reps: 1, lapses: 0 });
      expect(body.cards[1]).toMatchObject({ cardId: 2, stability: 9, difficulty: 8, reps: 4, lapses: 2 });
    });
  });
});
