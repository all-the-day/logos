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

// 录音与转码全 mock：测试只关心"识别文本填入 → 未核对不得提交"的门槛逻辑
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

describe("语音输入已核对门槛（Enter 与提交按钮共用）", () => {
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

  it("识别后未勾选已核对时 Enter 不进入比对；勾选后可提交", async () => {
    const user = userEvent.setup();
    const tasks: TaskData[] = [
      makeTask({ id: 101, verse: 1, content: "测试经文内容", cardState: "review" }),
    ];

    render(<LearnClient plan={plan} tasks={tasks} asrEnabled />);

    // 复习卡直接进背诵态：录音 → 停止 → 识别文本填入输入框
    await user.click(screen.getByRole("button", { name: /语音输入/ }));
    await user.click(await screen.findByRole("button", { name: /停止录音/ }));
    await waitFor(() =>
      expect((screen.getByPlaceholderText("在此输入经文...") as HTMLTextAreaElement).value).toBe(
        "测试经文内容"
      )
    );

    // 识别完成：出现回放与勾选框，提交按钮被禁用
    expect(screen.getByLabelText(/播放录音并核对/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /提交/ })).toBeDisabled();

    // 未勾选时按 Enter 不得绕过门槛进入比对
    screen.getByPlaceholderText("在此输入经文...").focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByText(/准确率/)).not.toBeInTheDocument();

    // 勾选后 Enter 正常进入比对
    await user.click(screen.getByLabelText(/播放录音并核对/));
    expect(screen.getByRole("button", { name: /提交/ })).toBeEnabled();
    await user.keyboard("{Enter}");
    expect(await screen.findByText(/准确率 100%/)).toBeInTheDocument();
  });
});
