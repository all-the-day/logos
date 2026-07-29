export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function isWeekday(date: Date): boolean {
  return date.getDay() !== 0; // 0 = Sunday
}
