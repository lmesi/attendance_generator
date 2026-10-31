import { describe, expect, it } from "vitest";
import {
  addDays,
  datesOfMonth,
  dayInfo,
  easterSunday,
  hasMovedDaysData,
  movedDays,
  publicHolidays,
  weekdayIndex,
} from "../src/index.ts";

describe("dates", () => {
  it("knows weekdays and month lengths", () => {
    expect(weekdayIndex("2026-10-01")).toBe(3); // Thursday
    expect(weekdayIndex("2026-10-04")).toBe(6); // Sunday
    expect(datesOfMonth(2026, 10)).toHaveLength(31);
    expect(datesOfMonth(2028, 2)).toHaveLength(29);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("holidays", () => {
  it.each([
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2029, "2029-04-01"],
    [2030, "2030-04-21"],
  ])("computes Easter Sunday %i", (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });

  it("derives the Easter-based holidays of 2026", () => {
    const holidays = publicHolidays(2026);
    expect(holidays.get("2026-04-03")).toBe("Nagypéntek");
    expect(holidays.get("2026-04-06")).toBe("Húsvéthétfő");
    expect(holidays.get("2026-05-24")).toBe("Pünkösdvasárnap");
    expect(holidays.get("2026-05-25")).toBe("Pünkösdhétfő");
    expect(holidays.size).toBe(13);
  });
});

describe("dayInfo", () => {
  it("treats 2026-10-23 as a public holiday", () => {
    expect(dayInfo("2026-10-23")).toMatchObject({ kind: "holiday", weekdayName: "Péntek" });
  });

  it("treats the moved rest day 2026-01-02 as a rest day, not a holiday", () => {
    const info = dayInfo("2026-01-02");
    expect(info.kind).toBe("restday");
    expect(info.holidayName).toBeUndefined();
  });

  it("treats the working Saturday 2026-01-10 as a workday", () => {
    expect(dayInfo("2026-01-10")).toMatchObject({ kind: "workday", weekdayName: "Szombat" });
  });

  it("separates weekends and ordinary workdays", () => {
    expect(dayInfo("2026-10-03").kind).toBe("weekend");
    expect(dayInfo("2026-10-05").kind).toBe("workday");
  });
});

describe("moved days data", () => {
  it("lists rest days on weekdays and working days on Saturdays", () => {
    const data = movedDays(2026)!;
    for (const date of data.restDays) expect(weekdayIndex(date)).toBeLessThan(5);
    for (const date of data.workingSaturdays) expect(weekdayIndex(date)).toBe(5);
    expect(hasMovedDaysData(2026)).toBe(true);
    expect(hasMovedDaysData(2031)).toBe(false);
  });
});
