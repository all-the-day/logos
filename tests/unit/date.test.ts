import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTodayString,
  getDateString,
  getTodayLabel,
  isWeekday,
  parseDateInput,
} from "@/lib/date";

// 时区由 vitest.config.ts 固定为 Asia/Shanghai（+08:00）

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getDateString", () => {
  it("输出本地 YYYY-MM-DD（+08:00 边界）", () => {
    // 2026-08-07 12:00 +08
    expect(getDateString(new Date("2026-08-07T04:00:00.000Z"))).toBe("2026-08-07");
    // 2026-08-08 00:00 +08 —— UTC 跨天但本地未跨天
    expect(getDateString(new Date("2026-08-07T16:00:00.000Z"))).toBe("2026-08-08");
    // 2026-08-07 23:59 +08
    expect(getDateString(new Date("2026-08-07T15:59:59.000Z"))).toBe("2026-08-07");
  });

  it("月与日补零", () => {
    expect(getDateString(new Date("2026-01-05T04:00:00.000Z"))).toBe("2026-01-05");
    expect(getDateString(new Date("2026-11-25T04:00:00.000Z"))).toBe("2026-11-25");
  });
});

describe("getTodayString", () => {
  it("与冻结系统时间一致（+08:00 跨零点）", () => {
    vi.setSystemTime(new Date("2026-08-07T15:59:59.000Z")); // 23:59:59 +08
    expect(getTodayString()).toBe("2026-08-07");
    vi.setSystemTime(new Date("2026-08-07T16:00:00.000Z")); // 00:00:00 +08
    expect(getTodayString()).toBe("2026-08-08");
  });

  it("月末/年末边界", () => {
    vi.setSystemTime(new Date("2026-01-31T16:30:00.000Z")); // 2026-02-01 00:30 +08
    expect(getTodayString()).toBe("2026-02-01");
    vi.setSystemTime(new Date("2026-12-31T16:30:00.000Z")); // 2027-01-01 00:30 +08
    expect(getTodayString()).toBe("2027-01-01");
  });
});

describe("getTodayLabel", () => {
  it("2026-08-07 为周五", () => {
    vi.setSystemTime(new Date("2026-08-07T04:00:00.000Z"));
    expect(getTodayLabel()).toBe("周五 · 8月7日");
  });

  it("支持显式传入日期", () => {
    expect(getTodayLabel(new Date("2026-08-10T04:00:00.000Z"))).toBe("周一 · 8月10日");
    expect(getTodayLabel(new Date("2026-08-09T04:00:00.000Z"))).toBe("周日 · 8月9日");
  });
});

describe("isWeekday", () => {
  it("周日为 false，其余为 true", () => {
    expect(isWeekday(new Date("2026-08-09T04:00:00.000Z"))).toBe(false); // 周日
    expect(isWeekday(new Date("2026-08-07T04:00:00.000Z"))).toBe(true); // 周五
    expect(isWeekday(new Date("2026-08-10T04:00:00.000Z"))).toBe(true); // 周一
    expect(isWeekday(new Date("2026-08-08T04:00:00.000Z"))).toBe(true); // 周六
  });
});

describe("parseDateInput（API 边界日期校验）", () => {
  it("合法字符串/数字/Date 返回 Date", () => {
    const iso = "2026-08-07T04:00:00.000Z";
    expect(parseDateInput(iso)?.toISOString()).toBe(iso);
    expect(parseDateInput(1786089600000)?.getTime()).toBe(1786089600000);
    const d = new Date(iso);
    expect(parseDateInput(d)).toBe(d);
  });

  it("空值返回 null（null / undefined / 空串）", () => {
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput(undefined)).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("非法值返回 null（Invalid Date 不落库）", () => {
    expect(parseDateInput("not-a-date")).toBeNull();
    expect(parseDateInput(Number.NaN)).toBeNull();
    expect(parseDateInput(new Date("invalid"))).toBeNull();
    expect(parseDateInput({})).toBeNull();
  });
});
