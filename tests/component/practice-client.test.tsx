// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import LearnClient from "@/app/learn/LearnClient";
import type { TaskData } from "@/types";

afterEach(cleanup);

// next/link 在 jsdom 下需要 router 上下文，mock 成普通 <a>
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", props, children),
}));

const task: TaskData = {
  id: 5015,
  bookId: 50,
  bookName: "腓立比书",
  chapter: 4,
  verse: 15,
  content: "第15节经文",
  kjv: null,
  cardId: 7,
  cardState: "new",
  cardStability: 2,
  cardDifficulty: 5,
  cardReps: 0,
  cardLapses: 0,
  cardLastReview: null,
  cardDue: new Date(),
};

describe("LearnClient 自由练习模式", () => {
  it("没有计划时也能进入练习，不再要求先建计划", () => {
    render(<LearnClient plan={null} tasks={[task]} practice />);

    expect(screen.queryByText("请先创建学习计划。")).not.toBeInTheDocument();
    expect(screen.getByText("自由练习")).toBeInTheDocument();
    // 经节引用同时出现在顶栏与查看卡，用 role 精确定位顶栏标题
    expect(
      screen.getByRole("heading", { name: "腓立比书 4:15" })
    ).toBeInTheDocument();
  });

  it("队列走完后显示练习完成，并提供再练一组入口", () => {
    render(<LearnClient plan={null} tasks={[]} practice />);

    expect(screen.getByText("练习完成！")).toBeInTheDocument();
    expect(screen.getByText("再练一组")).toBeInTheDocument();
  });
});
