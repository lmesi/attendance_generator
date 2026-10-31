import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAttendanceSheet, parseTogglCsv, type BuildOptions } from "../src/index.ts";
import { employer, entry } from "./helpers.ts";

function build(overrides: Partial<BuildOptions>) {
  return buildAttendanceSheet({ entries: [], employee: "Teszt Elek", employer, baseHours: 40, ...overrides });
}

const day = (sheet: ReturnType<typeof build>, date: string) => sheet.days.find((d) => d.date === date)!;

describe("start-date distribution", () => {
  const october = parseTogglCsv(readFileSync(new URL("../../../fixtures/toggl-2026-10.csv", import.meta.url), "utf8"));

  it("caps every workday from the start date at 8 hours and reports the leftover", () => {
    // From Mon 19 Oct: 19-22 and 26-30 are workdays, 23 is a public holiday -> 9 days.
    const sheet = build({ entries: october, startDate: "2026-10-19" });
    const dist = sheet.startDateDistribution!;
    expect(dist.toDates).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30",
    ]);
    expect(dist).toMatchObject({ pooledSeconds: 376149, placedSeconds: 9 * 8 * 3600, leftoverSeconds: 116949, leftover: "32,49" });
    for (const date of dist.toDates) {
      expect(day(sheet, date).cells).toMatchObject({ arrival: "9:00", leaving: "17:00", hours: "8,00" });
    }
    expect(sheet.totals).toMatchObject({ total: "72,00", base: "40,00", extra: "32,00" });
    expect(sheet.warnings).toEqual([
      "32,49 hours did not fit (max 8,00 hours a day on 9 workdays from 2026-10-19) and are not on the sheet.",
    ]);
    expect(sheet.notes).toEqual([]);
  });

  it("leaves the days before the start date empty", () => {
    const sheet = build({ entries: october, startDate: "2026-10-19" });
    expect(day(sheet, "2026-10-01").cells).toMatchObject({ arrival: "", leaving: "", hours: "" });
    expect(day(sheet, "2026-10-01").trackedSeconds).toBe(16565);
    expect(day(sheet, "2026-10-01").seconds).toBe(0);
    expect(day(sheet, "2026-10-03")).toMatchObject({ grey: true, cells: { hours: "" } });
    expect(day(sheet, "2026-10-23").cells.hours).toBe("Munkaszüneti nap");
  });

  it("divides evenly when the hours fit, with no leftover", () => {
    // 10 h tracked, partly on a weekend, start Wed 28 Oct -> 28, 29, 30.
    const sheet = build({ entries: [entry("2026-10-03", 4 * 3600), entry("2026-10-05", 6 * 3600)], startDate: "2026-10-28" });
    expect(["2026-10-28", "2026-10-29", "2026-10-30"].map((d) => day(sheet, d).seconds)).toEqual([12000, 12000, 12000]);
    expect(day(sheet, "2026-10-28").cells).toMatchObject({ hours: "3,33", leaving: "12:20" });
    expect(sheet.startDateDistribution!.leftoverSeconds).toBe(0);
    expect(sheet.warnings).toEqual([]);
    expect(sheet.totals.seconds).toBe(36000);
  });

  it("follows the Toggl pattern when the hours fit, capping busy days", () => {
    // 30 h in total: 26 Oct 9 h, 27 Oct 1 h, 4 h before the start; 28-30 Oct nothing tracked.
    // Untracked days weigh as the average tracked day (5 h): weights 9, 1, 5, 5, 5 over 25.
    // 26 Oct would get 10.8 h, so it is capped at 8 h; the other 22 h follow weights 1, 5, 5, 5.
    const sheet = build({
      entries: [entry("2026-10-05", 20 * 3600), entry("2026-10-26", 9 * 3600), entry("2026-10-27", 3600)],
      startDate: "2026-10-26",
    });
    expect(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"].map((d) => day(sheet, d).seconds)).toEqual([
      28800, 4950, 24750, 24750, 24750,
    ]);
    expect(sheet.startDateDistribution!.leftoverSeconds).toBe(0);
    expect(sheet.totals.seconds).toBe(30 * 3600);
  });

  it("skips leave days and honours a custom cap", () => {
    const sheet = build({
      entries: [entry("2026-10-05", 20 * 3600)],
      startDate: "2026-10-26",
      leave: [{ date: "2026-10-27", label: "Szabadság" }],
      maxDailyHours: 4,
    });
    expect(sheet.startDateDistribution!.toDates).toEqual(["2026-10-26", "2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(day(sheet, "2026-10-26").cells.hours).toBe("4,00");
    expect(day(sheet, "2026-10-27").cells.hours).toBe("Szabadság");
    expect(sheet.startDateDistribution!.leftover).toBe("4,00");
  });

  it("pools hours tracked on a leave day instead of rejecting them", () => {
    const sheet = build({
      entries: [entry("2026-10-27", 3600)],
      startDate: "2026-10-26",
      leave: [{ date: "2026-10-27", label: "Szabadság" }],
    });
    expect(sheet.totals.seconds).toBe(3600);
  });

  it("ignores leave and 0-hour days before the start date", () => {
    const sheet = build({
      entries: [entry("2026-10-01", 3600)],
      startDate: "2026-10-20",
      leave: [{ date: "2026-10-12", label: "Szabadság" }],
      zeroDays: ["2026-10-16"],
    });
    expect(day(sheet, "2026-10-12")).toMatchObject({ type: "workday", cells: { hours: "" } });
    expect(day(sheet, "2026-10-16")).toMatchObject({ type: "workday", cells: { hours: "" } });
    expect(sheet.startDateDistribution!.toDates[0]).toBe("2026-10-20");
    expect(sheet.missingDays).toEqual([]);
  });

  it("ignores the weekend policy", () => {
    const sheet = build({ entries: [entry("2026-10-03", 3600)], startDate: "2026-10-05", weekendPolicy: "reject" });
    expect(sheet.redistribution).toBeNull();
    expect(sheet.totals.seconds).toBe(3600);
  });

  it("validates the start date", () => {
    expect(() => build({ month: "2026-10", startDate: "2026-11-02" })).toThrow(/outside 2026-10/);
    expect(() => build({ month: "2026-10", startDate: "2026-10-32" })).toThrow(/not a valid date/);
    expect(() => build({ month: "2026-10", startDate: "2026-10-31" })).toThrow(/no workday from 2026-10-31/);
    expect(() => build({ month: "2026-10", startDate: "2026-10-19", maxDailyHours: 0 })).toThrow(/positive/);
  });
});
