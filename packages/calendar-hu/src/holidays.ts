import { addDays, isoDate } from "./dates.ts";

/** Gregorian Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

const FIXED_HOLIDAYS: ReadonlyArray<[month: number, day: number, name: string]> = [
  [1, 1, "Újév"],
  [3, 15, "Nemzeti ünnep"],
  [5, 1, "A munka ünnepe"],
  [8, 20, "Államalapítás ünnepe"],
  [10, 23, "Nemzeti ünnep"],
  [11, 1, "Mindenszentek"],
  [12, 25, "Karácsony"],
  [12, 26, "Karácsony másnapja"],
];

/** Public holidays (munkaszüneti napok) of a year, keyed by date. */
export function publicHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  for (const [month, day, name] of FIXED_HOLIDAYS) holidays.set(isoDate(year, month, day), name);
  const easter = easterSunday(year);
  holidays.set(addDays(easter, -2), "Nagypéntek");
  holidays.set(easter, "Húsvétvasárnap");
  holidays.set(addDays(easter, 1), "Húsvéthétfő");
  holidays.set(addDays(easter, 49), "Pünkösdvasárnap");
  holidays.set(addDays(easter, 50), "Pünkösdhétfő");
  return holidays;
}
