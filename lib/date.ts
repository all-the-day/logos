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
