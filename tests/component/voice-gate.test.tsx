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

// 录音与转码全 mock：测试只关心“按住大区域说话 → 松手识别 → 直接比对”
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

  it("默认展示微信式“按住 说话”大区域；按住变“松开 结束”，松手识别后回文字态可提交", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({ id: 101, verse: 1, content: "测试经文内容", cardState: "review" }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} asrEnabled />);

    // 默认就是语音大区域，不再有难按的小按钮
    const talkArea = screen.getByRole("button", { name: "按住 说话" });
    expect(talkArea).toBeInTheDocument();
    expect(talkArea.className).toContain("min-h-32");

    fireEvent.touchStart(talkArea);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /松开 结束/ })).toBeInTheDocument()
    );
    fireEvent.touchEnd(screen.getByRole("button", { name: /松开 结束/ }));

    // 识别完成自动回到文字态，文本已填入
    await waitFor(() =>
      expect((screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement).value).toBe(
        "测试经文内容"
      )
    );

    // 有可选录音回放、没有“已核对”勾选，提交直接可用
    expect(screen.getByText(/播放我的录音/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/播放录音并核对/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /提交/ })).toBeEnabled();

    // Enter 直接进入既有文本比对（全套并行时 jsdom 较慢，放宽等待避免时序抖动）
    screen.getByPlaceholderText("在此输入经文...").focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText(/准确率 100%/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("按住说话期间按 Enter/Space 不会误提交", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({ id: 101, verse: 1, content: "测试经文内容", cardState: "review" }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} asrEnabled />);
    fireEvent.touchStart(screen.getByRole("button", { name: "按住 说话" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /松开 结束/ })).toBeInTheDocument()
    );

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: " " });
    expect(screen.queryByText(/准确率/)).not.toBeInTheDocument();
    void user;
  });

  it("可以切回文字输入，也能再切回语音", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({ id: 101, verse: 1, content: "测试经文内容", cardState: "review" }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} asrEnabled />);
    await user.click(screen.getByRole("button", { name: /文字输入/ }));
    expect(screen.getByPlaceholderText("在此输入经文...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /语音输入/ }));
    expect(screen.getByRole("button", { name: "按住 说话" })).toBeInTheDocument();
  });

  it("不支持录音的环境长按时给出回退提示", async () => {
    // 单独用例：把 recorder mock 成“不支持录音”
    vi.resetModules();
    vi.doMock("@/lib/audio/recorder", () => ({
      MAX_RECORD_SECONDS: 60,
      getRecordingSupport: () => false,
      createRecorder: () => ({ start: async () => {}, stop: async () => new Blob([]), cancel: () => {} }),
      convertToWav: async () => new Blob([]),
    }));
    const { default: LearnClientNoSupport } = await import("@/app/learn/LearnClient");
    const tasks: TaskData[] = [
      makeTask({ id: 101, verse: 1, content: "测试经文内容", cardState: "review" }),
    ];
    render(<LearnClientNoSupport plan={plan} tasks={tasks} asrEnabled />);
    fireEvent.touchStart(screen.getByRole("button", { name: "按住 说话" }));
    expect(screen.getByRole("alert")).toHaveTextContent("不支持录音");
  });
});
