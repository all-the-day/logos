// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { VerseReciter } from "@/components/VerseStudy";

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

afterEach(cleanup);

const verse = {
  id: 1,
  bookName: "罗马书",
  chapter: 3,
  verse: 23,
  content: "因为众人都犯了罪，亏缺了神的荣耀。",
  kjv: null,
};

function renderReciter(options?: { asrEnabled?: boolean; fillMode?: boolean }) {
  return render(
    <VerseReciter
      verse={verse}
      fillMode={options?.fillMode ?? false}
      fillInputs={[]}
      setFillInputs={() => undefined}
      userInput=""
      setUserInput={() => undefined}
      inputRef={{ current: null }}
      onSubmit={() => undefined}
      asrEnabled={options?.asrEnabled ?? false}
      recordingUrl=""
      setRecordingUrl={() => undefined}
    />
  );
}

describe("VerseReciter 语音入口", () => {
  it("asrEnabled 时默认展示“按住 说话”大区域，而不是小按钮", () => {
    renderReciter({ asrEnabled: true });
    const talkArea = screen.getByRole("button", { name: "按住 说话" });
    expect(talkArea).toBeInTheDocument();
    expect(talkArea.className).toContain("min-h-32");
  });

  it("asrEnabled=false 时展示文本框，不显示语音区域", () => {
    renderReciter({ asrEnabled: false });
    expect(screen.queryByRole("button", { name: "按住 说话" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("在此输入经文...")).toBeInTheDocument();
  });

  it("按住后区域变为“松开 结束”并显示计时", async () => {
    renderReciter({ asrEnabled: true });
    fireEvent.touchStart(screen.getByRole("button", { name: "按住 说话" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "松开 结束" })).toBeInTheDocument()
    );
    expect(screen.getByText(/0s \/ 60s/)).toBeInTheDocument();
  });

  it("填空模式不显示语音区域", () => {
    renderReciter({ asrEnabled: true, fillMode: true });
    expect(screen.queryByRole("button", { name: "按住 说话" })).not.toBeInTheDocument();
  });
});
