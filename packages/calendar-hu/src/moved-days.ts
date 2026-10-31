import data2026 from "../data/2026.json" with { type: "json" };

/** Official moved days of one year (munkanap-áthelyezés). */
export interface MovedDays {
  year: number;
  source: string;
  note?: string;
  /** Weekdays that are rest days (bridge days off). */
  restDays: string[];
  /** Saturdays that are working days. */
  workingSaturdays: string[];
}

// Add a new year by dropping data/<year>.json next to 2026.json and listing it here.
const MOVED_DAYS: ReadonlyMap<number, MovedDays> = new Map([[2026, data2026]]);

export function movedDays(year: number): MovedDays | undefined {
  return MOVED_DAYS.get(year);
}

export function hasMovedDaysData(year: number): boolean {
  return MOVED_DAYS.has(year);
}
