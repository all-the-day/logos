/**
 * 中文经文 LCS 对比引擎
 */

export interface DiffSegment {
  tag: "correct" | "wrong" | "missing" | "extra";
  text?: string;
  original?: string;
  user?: string;
}

interface Opcode {
  tag: "equal" | "insert" | "delete";
  aIdx: number;
  bIdx: number;
}

function buildLCSMatrix(a: string, b: string): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function backtrack(dp: number[][], a: string, b: string): Opcode[] {
  const ops: Opcode[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ tag: "equal", aIdx: i - 1, bIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ tag: "insert", aIdx: i, bIdx: j - 1 });
      j--;
    } else {
      ops.unshift({ tag: "delete", aIdx: i - 1, bIdx: j });
      i--;
    }
  }
  return ops;
}

function mergeOps(ops: Opcode[], a: string, b: string): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let i = 0;
  while (i < ops.length) {
    const tag = ops[i].tag;
    if (tag === "equal") {
      let end = i;
      while (end < ops.length && ops[end].tag === "equal") end++;
      segments.push({
        tag: "correct",
        text: ops.slice(i, end).map((op) => a[op.aIdx]).join(""),
      });
      i = end;
    } else if (tag === "delete") {
      let end = i;
      while (end < ops.length && ops[end].tag === "delete") end++;
      const original = ops.slice(i, end).map((op) => a[op.aIdx]).join("");
      if (end < ops.length && ops[end].tag === "insert") {
        let insertEnd = end;
        while (insertEnd < ops.length && ops[insertEnd].tag === "insert") insertEnd++;
        const userText = ops.slice(end, insertEnd).map((op) => b[op.bIdx]).join("");
        segments.push({ tag: "wrong", original, user: userText });
        i = insertEnd;
      } else {
        segments.push({ tag: "missing", text: original });
        i = end;
      }
    } else {
      let end = i;
      while (end < ops.length && ops[end].tag === "insert") end++;
      const userText = ops.slice(i, end).map((op) => b[op.bIdx]).join("");
      if (end < ops.length && ops[end].tag === "delete") {
        let delEnd = end;
        while (delEnd < ops.length && ops[delEnd].tag === "delete") delEnd++;
        const original = ops.slice(end, delEnd).map((op) => a[op.aIdx]).join("");
        segments.push({ tag: "wrong", original, user: userText });
        i = delEnd;
      } else {
        segments.push({ tag: "extra", text: userText });
        i = end;
      }
    }
  }
  return segments;
}

export function normalize(text: string, ignorePunctuation = false): string {
  let t = text.replace(/\s+/g, "");
  if (ignorePunctuation) {
    t = t.replace(/[，,。.；;：:、！!？?""''（）()《》【】\[\]]/g, "");
  }
  return t;
}

export interface CompareResult {
  segments: DiffSegment[];
  accuracy: number;
}

/**
 * 比对经文，返回分段差异与准确率。
 * 默认忽略标点与空白差异——中文标点（、，；。：）和英文逗号句号混用是常态。
 */
export function compareVerse(
  userInput: string,
  original: string,
  ignorePunctuation: boolean = true
): CompareResult {
  const u = normalize(userInput, ignorePunctuation);
  const o = normalize(original, ignorePunctuation);
  if (!o) return { segments: [], accuracy: 1.0 };
  if (!u) return { segments: [{ tag: "missing", text: o }], accuracy: 0 };

  const dp = buildLCSMatrix(o, u);
  const ops = backtrack(dp, o, u);
  const segments = mergeOps(ops, o, u);
  const correctCount = ops.filter((op) => op.tag === "equal").length;
  const accuracy = o.length > 0 ? correctCount / o.length : 1.0;
  return { segments, accuracy };
}

export function generateFillBlanks(
  text: string,
  density: number = 0.33
): {
  display: string;
  blanks: string[];
} {
  const chars: string[] = [];
  for (const ch of text) {
    if (ch.trim()) chars.push(ch);
  }
  if (chars.length === 0) return { display: text, blanks: [] };

  // density=0.5 → 挖 1/2；0.33 → 1/3；0.2 → 1/5；0.1 → 1/10
  const step = density > 0 ? Math.max(1, Math.round(1 / density)) : 1;
  const startOffset = Math.max(0, step - 1);

  const blankCharIndices = new Set<number>();
  for (let i = startOffset; i < chars.length; i += step) {
    blankCharIndices.add(i);
  }

  const blanks: string[] = [];
  let display = "";
  let charIdx = 0;

  for (const ch of text) {
    if (!ch.trim()) {
      display += ch;
    } else if (blankCharIndices.has(charIdx)) {
      display += "___";
      blanks.push(ch);
      charIdx++;
    } else {
      display += ch;
      charIdx++;
    }
  }

  return { display, blanks };
}

/**
 * 根据卡片稳定性与状态返回填空密度。
 * - 未学（new）：0.1（极轻提示，几乎不挖）
 * - 学习中（< 5 天）：0.2
 * - 复习期（5-20 天）：0.33
 * - 已掌握（≥ 21 天）：0.5（深挖）
 */
export function densityForStability(
  stability: number,
  state: string
): number {
  if (state === "new") return 0.1;
  if (stability >= 21) return 0.5;
  if (stability >= 5) return 0.33;
  if (stability >= 1) return 0.2;
  return 0.1;
}
