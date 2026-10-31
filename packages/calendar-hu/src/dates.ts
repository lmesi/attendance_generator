// Dates are plain "YYYY-MM-DD" strings. Day arithmetic goes through UTC day
// numbers, so no local time zone can shift a date by one.

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseYearMonth(value: string): YearMonth | null {
  const m = YEAR_MONTH.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

export function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

export function yearMonthOf(date: string): string {
  return date.slice(0, 7);
}

export function toDayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function fromDayNumber(dayNumber: number): string {
  const dt = new Date(dayNumber * MS_PER_DAY);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(date: string): number {
  return (new Date(toDayNumber(date) * MS_PER_DAY).getUTCDay() + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function datesOfMonth(year: number, month: number): string[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => isoDate(year, month, i + 1));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
