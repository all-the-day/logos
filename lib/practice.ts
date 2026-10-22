/**
 * 自由练习的纯参数校验（不查库，不依赖 Prisma）。
 * 书卷/章/节号的实际合法范围由 services/practice.ts 按数据库校验。
 */
export const MAX_PRACTICE_VERSES = 50;
export const MIN_PASSAGE_SIZE = 2;
export const MAX_PASSAGE_SIZE = 10;
export const DEFAULT_PASSAGE_SIZE = 5;

export type PracticeParsed = {
  bookId: number;
  chapter: number;
  from: number;
  /** 省略表示"到本章末"，由服务端按实际经节解析 */
  to?: number;
  mode: "single" | "passage";
  passageSize: number;
};

export type PracticeParseResult =
  | { ok: true; range: PracticeParsed }
  | { ok: false; status: number; error: string };

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function toInt(value: unknown): number | null {
  const v = first(value);
  if (typeof v === "number") return Number.isInteger(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

export function parsePracticeParams(
  input: Record<string, unknown>
): PracticeParseResult {
  const bookId = toInt(input.bookId);
  const chapter = toInt(input.chapter);
  if (!bookId || bookId <= 0) return { ok: false, status: 400, error: "请选择书卷" };
  if (!chapter || chapter <= 0) return { ok: false, status: 400, error: "请选择章" };

  const rawFrom = first(input.from);
  const rawTo = first(input.to);
  const from =
    rawFrom === undefined || rawFrom === null || rawFrom === "" ? 1 : toInt(rawFrom);
  const to = rawTo === undefined || rawTo === null || rawTo === "" ? undefined : toInt(rawTo);

  if (from === null || from < 1) {
    return { ok: false, status: 400, error: "起始节号需为正整数" };
  }
  if (to !== undefined && (to === null || to < 1)) {
    return { ok: false, status: 400, error: "结束节号需为正整数" };
  }
  if (to !== undefined && to < from) {
    return { ok: false, status: 400, error: "结束节号需不小于起始节号" };
  }
  // 节数上限按数据库中的实际经节数校验（services/practice.ts），
  // 因为部分章节节号不连续（如以弗所书 3 章 19 节、跨度 21），按跨度判断会误拒。

  const mode = first(input.mode) === "passage" ? "passage" : "single";
  const rawSize = first(input.size ?? input.passageSize);
  const passageSize =
    rawSize === undefined || rawSize === null || rawSize === "" ? DEFAULT_PASSAGE_SIZE : toInt(rawSize);
  if (
    mode === "passage" &&
    (passageSize === null || passageSize < MIN_PASSAGE_SIZE || passageSize > MAX_PASSAGE_SIZE)
  ) {
    return {
      ok: false,
      status: 400,
      error: `每组节数需为 ${MIN_PASSAGE_SIZE}-${MAX_PASSAGE_SIZE} 的整数`,
    };
  }

  return {
    ok: true,
    range: {
      bookId,
      chapter,
      from,
      to: to ?? undefined,
      mode,
      passageSize: passageSize ?? DEFAULT_PASSAGE_SIZE,
    },
  };
}
