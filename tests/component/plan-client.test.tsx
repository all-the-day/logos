// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import PlanClient from "@/app/plan/PlanClient";
import type { BookInfo, DailyVerse, PlanInfo } from "@/types";

afterEach(cleanup);

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", props, children),
}));

const plan: PlanInfo = {
  id: 1,
  bookId: 45,
  versesPerDay: 3,
  reciteMode: "single",
  passageSize: 5,
  startDate: new Date(),
  status: "active",
};

const book: BookInfo = { id: 45, name: "罗马书" } as BookInfo;
const books: BookInfo[] = [book];

function renderPlan(overrides: {
  checkin?: { checkedIn: boolean; streak: number };
  dailyVerse?: DailyVerse | null;
} = {}) {
  return render(
    <PlanClient
      planDetails={{ plan, book, totalVerses: 433, workdays: 145 }}
      progress={null}
      books={books}
      checkin={overrides.checkin ?? { checkedIn: false, streak: 0 }}
      dailyVerse={
        overrides.dailyVerse === undefined
          ? {
              content: "在你们中间不免有派别",
              book: "哥林多前书",
              chapter: 11,
              section: 19,
              kjv: "For there must be also heresies among you",
              reference: "哥林多前书 11:19",
            }
          : overrides.dailyVerse
      }
      todaySummary={{ review: 2, new: 3 }}
      todayReviewed={2}
      todayNewCount={0}
    />
  );
}

describe("PlanClient 签到反馈", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("签到失败时在签到卡内显示错误，而不是静默无反应", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "服务繁忙" }) }))
    );
    renderPlan();

    await userEvent.click(screen.getByRole("button", { name: "签到" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("服务繁忙");
    // 仍停留在未签到态，用户可以重试
    expect(screen.getByText("未签到")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "签到" })).toBeEnabled();
  });

  it("网络异常时也给出可读提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    renderPlan();

    await userEvent.click(screen.getByRole("button", { name: "签到" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("网络错误");
  });

  it("签到成功后原位切换为每日金句，错误提示消失", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ streak: 4 }) }))
    );
    renderPlan();

    await userEvent.click(screen.getByRole("button", { name: "签到" }));

    expect(await screen.findByText("在你们中间不免有派别")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "签到" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
