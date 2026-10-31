import { weekdayIndex } from "./dates.ts";
import { publicHolidays } from "./holidays.ts";
import { movedDays } from "./moved-days.ts";
import { HU_WEEKDAYS } from "./names.ts";

/**
 * workday: Monday-Friday that is not a holiday or rest day, or a working Saturday.
 * weekend: Saturday or Sunday.
 * holiday: public holiday (munkaszüneti nap), on any weekday.
 * restday: weekday made a rest day by a moved-day decree; treated like a weekend day.
 */
export type DayKind = "workday" | "weekend" | "holiday" | "restday";

export interface DayInfo {
  date: string;
  /** 0 = Monday ... 6 = Sunday */
  weekdayIndex: number;
  weekdayName: string;
  kind: DayKind;
  holidayName?: string;
}

export function dayInfo(date: string): DayInfo {
  const year = Number(date.slice(0, 4));
  const index = weekdayIndex(date);
  const base = { date, weekdayIndex: index, weekdayName: HU_WEEKDAYS[index]! };

  const holidayName = publicHolidays(year).get(date);
  if (holidayName) return { ...base, kind: "holiday", holidayName };

  const moved = movedDays(year);
  if (moved?.restDays.includes(date)) return { ...base, kind: "restday" };
  if (moved?.workingSaturdays.includes(date)) return { ...base, kind: "workday" };

  return { ...base, kind: index >= 5 ? "weekend" : "workday" };
}
