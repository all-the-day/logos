// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { VerseReciter } from "@/components/VerseStudy";

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
    />
  );
}

describe("VerseReciter 语音入口", () => {
  it("asrEnabled 时显示语音按钮，空输入时禁用提交", () => {
    renderReciter({ asrEnabled: true });
    expect(screen.getByRole("button", { name: /语音输入/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /提交/ })).toBeDisabled();
  });

  it("asrEnabled=false 时不显示语音按钮", () => {
    renderReciter({ asrEnabled: false });
    expect(screen.queryByRole("button", { name: /语音输入/ })).not.toBeInTheDocument();
  });

  it("不支持录音的环境点击后给出回退提示", async () => {
    const user = userEvent.setup();
    renderReciter({ asrEnabled: true });
    await user.click(screen.getByRole("button", { name: /语音输入/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("不支持录音");
  });

  it("填空模式不显示语音按钮", () => {
    renderReciter({ asrEnabled: true, fillMode: true });
    expect(screen.queryByRole("button", { name: /语音输入/ })).not.toBeInTheDocument();
  });
});
