export function getTodayString(): string {
  return getDateString(new Date());
}

export function getDateString(date: Date): string {
  // 用本地时间而非 UTC，避免北京时间凌晨 0-8 点取到昨天
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isWeekday(date: Date): boolean {
  return date.getDay() !== 0; // 0 = Sunday
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function getTodayLabel(date: Date = new Date()): string {
  return `${WEEKDAYS[date.getDay()]} · ${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 解析 API 边界传入的日期值（JSON 反序列化后可能是字符串/数字/Date）。
 * - null / undefined / 空串 → null
 * - 非法值（Invalid Date）→ null
 * - 合法值 → Date
 * DB 层只应接收本函数返回的合法 Date（或 null）。
 */
export function parseDateInput(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}
