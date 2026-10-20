// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
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

// 录音与转码全 mock：测试只关心"识别文本填入 → 可直接提交走既有比对"
vi.mock("@/lib/audio/recorder", () => ({
  MAX_RECORD_SECONDS: 60,
  getRecordingSupport: () => true,
  createRecorder: () => ({
    start: async () => {},
    stop: async () => new Blob(["raw"], { type: "audio/webm" }),
    cancel: () => {},
  }),
  convertToWav: async () => new Blob(["wav"], { type: "audio/wav" }),
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
    id: 0,
    bookId: 1,
    bookName: "罗马书",
    chapter: 1,
    verse: 1,
    content: "",
    kjv: null,
    cardId: 1,
    cardState: "review",
    cardStability: 2,
    cardDifficulty: 5,
    cardReps: 0,
    cardLapses: 0,
    cardLastReview: null,
    cardDue: new Date(),
    ...overrides,
  };
}

describe("语音输入作为纯输入方式", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).startsWith("/api/asr")) {
          return { ok: true, status: 200, json: async () => ({ text: "测试经文内容" }) };
        }
        if (String(url).startsWith("/api/note")) {
          return { ok: true, status: 200, json: async () => ({ notes: [] }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      })
    );
    URL.createObjectURL = vi.fn(() => "blob:recording") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  });

  it("长按录音、松手识别：文本直接可提交，不设勾选门槛，仍提供录音回放", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({ id: 101, verse: 1, content: "测试经文内容", cardState: "review" }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} asrEnabled />);

    // 移动端长按交互：touchstart 开始（等 recorder 真正起来），touchend 停止并识别
    fireEvent.touchStart(screen.getByRole("button", { name: /长按语音输入/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /松开结束/ })).toBeInTheDocument()
    );
    fireEvent.touchEnd(screen.getByRole("button", { name: /松开结束/ }));

    await waitFor(() =>
      expect((screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement).value).toBe(
        "测试经文内容"
      )
    );

    // 识别完成：有可选回放，但提交按钮直接可用，没有"已核对"勾选
    expect(screen.getByText(/播放我的录音/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/播放录音并核对/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /提交/ })).toBeEnabled();

    // Enter 直接进入既有文本比对
    screen.getByPlaceholderText("在此输入经文...").focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText(/准确率 100%/)).toBeInTheDocument();
  });

  it("长按期间按钮变为“松开结束”，且按 Enter 不会误提交", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({ id: 101, verse: 1, content: "测试经文内容", cardState: "review" }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} asrEnabled />);
    fireEvent.touchStart(screen.getByRole("button", { name: /长按语音输入/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /松开结束/ })).toBeInTheDocument()
    );

    screen.getByPlaceholderText("在此输入经文...").focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByText(/准确率/)).not.toBeInTheDocument();
  });
});
