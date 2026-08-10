import { describe, it, expect } from "vitest";
import {
  compareVerse,
  normalize,
  generateFillBlanks,
  densityForStability,
  type DiffSegment,
} from "@/lib/compare";

/** 从差异段重建原文（original）或用户输入（user），用于验证差异段可无损还原 */
function reconstruct(segments: DiffSegment[], side: "original" | "user"): string {
  let out = "";
  for (const s of segments) {
    if (s.tag === "correct") out += s.text ?? "";
    // missing：仅在原文中存在，用户侧不计入
    if (s.tag === "missing" && side === "original") out += s.text ?? "";
    // extra：仅用户输入中存在，原文侧不计入
    if (s.tag === "extra" && side === "user") out += s.text ?? "";
    if (s.tag === "wrong") out += side === "original" ? s.original ?? "" : s.user ?? "";
  }
  return out;
}

describe("compareVerse 完全一致", () => {
  it("原文完全相同：准确率 1，全部 correct", () => {
    const r = compareVerse("太初有道，道与神同在。", "太初有道，道与神同在。");
    expect(r.accuracy).toBe(1);
    expect(r.segments.length).toBe(1);
    expect(r.segments[0].tag).toBe("correct");
  });

  it("默认忽略标点与空白", () => {
    const r = compareVerse("太初 有道 道与神同在", "太初有道，道与神同在。");
    expect(r.accuracy).toBe(1);
  });

  it("ignorePunctuation=false 时标点计入差异", () => {
    const r = compareVerse("太初有道道与神同在", "太初有道，道与神同在", false);
    expect(r.accuracy).toBeLessThan(1);
  });
});

describe("compareVerse 差异类型", () => {
  it("漏字：命中 missing 段，准确率按原文长度计算", () => {
    const r = compareVerse("太初有道", "太初有道道");
    expect(r.accuracy).toBeCloseTo(4 / 5, 5);
    expect(r.segments.some((s) => s.tag === "missing")).toBe(true);
  });

  it("错字：命中 wrong 段", () => {
    const r = compareVerse("太初有神", "太初有道");
    expect(r.accuracy).toBeCloseTo(3 / 4, 5);
    expect(r.segments.some((s) => s.tag === "wrong")).toBe(true);
  });

  it("多字：命中 extra 段（准确率不受影响）", () => {
    const r = compareVerse("太初有道啊", "太初有道");
    expect(r.accuracy).toBe(1);
    expect(r.segments.some((s) => s.tag === "extra")).toBe(true);
  });

  it("空输入：整段 missing，准确率 0", () => {
    const r = compareVerse("", "太初有道");
    expect(r.accuracy).toBe(0);
    expect(r.segments).toEqual([{ tag: "missing", text: "太初有道" }]);
  });

  it("空原文：准确率 1，无差异段", () => {
    const r = compareVerse("太初有道", "");
    expect(r.accuracy).toBe(1);
    expect(r.segments).toEqual([]);
  });
});

describe("compareVerse 歧义与还原", () => {
  it("重复字 LCS 歧义下准确率一致且可还原", () => {
    const original = "阿们阿们";
    const user = "阿们";
    const r = compareVerse(user, original);
    expect(r.accuracy).toBeCloseTo(2 / 4, 5);
    expect(reconstruct(r.segments, "original")).toBe(original);
    expect(reconstruct(r.segments, "user")).toBe(user);
  });

  it("混合差异可无损还原输入与目标（默认忽略标点）", () => {
    const cases: Array<[string, string]> = [
      ["太初有道，道与神同在。", "太初有道，神同在。"],
      ["神爱世人，甚至将他的独生子赐给他们", "神爱世人，独生子"],
      ["你们祈求，就给你们", "祈求就给"],
      ["天地要废去，我的话却不能废去", "天地会废去 话不能废"],
    ];
    for (const [original, user] of cases) {
      const r = compareVerse(user, original);
      // compareVerse 默认忽略标点，重建结果与 normalize(..., true) 对齐
      expect(reconstruct(r.segments, "original")).toBe(normalize(original, true));
      expect(reconstruct(r.segments, "user")).toBe(normalize(user, true));
    }
  });

  it("小字母集全组合：任意输入/目标差异段均可无损还原", () => {
    const alphabet = ["甲", "乙", "丙", "，"];
    const strings: string[] = [""];
    for (let len = 1; len <= 3; len++) {
      const prev = strings.filter((s) => s.length === len - 1);
      for (const s of prev) {
        for (const ch of alphabet) strings.push(s + ch);
      }
    }
    // 限定原文非空：原文为空时 compareVerse 走 !o 分支（见下方已知缺陷测试）
    for (const original of strings) {
      if (!normalize(original, true)) continue;
      for (const user of strings) {
        const r = compareVerse(user, original);
        expect(reconstruct(r.segments, "original")).toBe(normalize(original, true));
        expect(reconstruct(r.segments, "user")).toBe(normalize(user, true));
      }
    }
  });

  // 已知缺陷记录（P0 不改业务算法，供后续决策）：
  // compareVerse 原文为空时返回 { segments: [], accuracy: 1.0 }，用户输入被整个丢弃。
  // 真实经节不会为空，但语义上"原文为空 + 用户有输入"不应判为完全正确。
  // it.fails：当前行为下断言失败（期望通过测试转红）→ 套件仍绿；
  // 未来修复后 Vitest 会提示"不再失败"，届时移除 .fails 即可。
  it.fails("空原文不应丢弃用户输入并返回 100% 准确率", () => {
    const result = compareVerse("多余内容", "");
    expect(result.accuracy).not.toBe(1);
    expect(result.segments).not.toHaveLength(0);
  });
});

describe("generateFillBlanks", () => {
  it("各密度挖空数量与 step 约定一致（无空白文本）", () => {
    const text = "abcdefghij"; // 10 个字符，无空白
    expect(generateFillBlanks(text, 0.5).blanks.length).toBe(5);
    expect(generateFillBlanks(text, 0.33).blanks.length).toBe(3);
    expect(generateFillBlanks(text, 0.2).blanks.length).toBe(2);
    expect(generateFillBlanks(text, 0.1).blanks.length).toBe(1);
  });

  it("空白字符保留在 display 中，不参与挖空", () => {
    const r = generateFillBlanks("a b c", 0.5);
    expect(r.display).toBe("a ___ c");
    expect(r.blanks).toEqual(["b"]);
  });

  it("占位符按顺序替换后可还原原文", () => {
    const text = "神爱世人，甚至将他的独生子赐给他们";
    const { display, blanks } = generateFillBlanks(text, 0.5);
    let idx = 0;
    const rebuilt = display.replace(/___/g, () => blanks[idx++]);
    expect(rebuilt).toBe(text);
    expect(blanks.length).toBeGreaterThan(0);
  });

  it("空文本返回原样", () => {
    const r = generateFillBlanks("", 0.5);
    expect(r.display).toBe("");
    expect(r.blanks).toEqual([]);
  });
});

describe("densityForStability", () => {
  it("按稳定性分档（含边界）", () => {
    expect(densityForStability(0, "new")).toBe(0.1);
    expect(densityForStability(100, "new")).toBe(0.1);
    expect(densityForStability(30, "review")).toBe(0.5);
    expect(densityForStability(21, "review")).toBe(0.5);
    expect(densityForStability(20.99, "review")).toBe(0.33);
    expect(densityForStability(5, "review")).toBe(0.33);
    expect(densityForStability(4.99, "learning")).toBe(0.2);
    expect(densityForStability(1, "learning")).toBe(0.2);
    expect(densityForStability(0.99, "learning")).toBe(0.1);
  });
});
