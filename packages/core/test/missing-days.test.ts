import { describe, expect, it } from "vitest";
import { buildAttendanceSheet, InputError, type BuildOptions } from "../src/index.ts";
import { employer, entry } from "./helpers.ts";

function build(overrides: Partial<BuildOptions>) {
  return buildAttendanceSheet({ entries: [], employee: "Teszt Elek", employer, baseHours: 40, ...overrides });
}

const day = (sheet: ReturnType<typeof build>, date: string) => sheet.days.find((d) => d.date === date)!;

// October 2026 has 21 workdays (23 Oct is a public holiday).
describe("missing days", () => {
  it("lists every workday without hours, leave or a 0-hour confirmation", () => {
    const sheet = build({ entries: [entry("2026-10-01", 3600)] });
    expect(sheet.missingDays).toHaveLength(20);
    expect(sheet.missingDays[0]).toBe("2026-10-02");
    expect(day(sheet, "2026-10-02")).toMatchObject({ missing: true, cells: { hours: "-" } });
    expect(day(sheet, "2026-10-03").missing).toBe(false);
    expect(day(sheet, "2026-10-23").missing).toBe(false);
  });

  it("is resolved by leave days and 0-hour days", () => {
    const sheet = build({
      entries: [entry("2026-10-01", 3600)],
      leave: [{ date: "2026-10-02", label: "Betegszabadság" }],
      zeroDays: ["2026-10-05"],
    });
    expect(sheet.missingDays).not.toContain("2026-10-02");
    expect(sheet.missingDays).not.toContain("2026-10-05");
    expect(day(sheet, "2026-10-02")).toMatchObject({ type: "leave", missing: false, cells: { hours: "Betegszabadság" } });
    expect(day(sheet, "2026-10-05")).toMatchObject({
      type: "zero",
      missing: false,
      seconds: 0,
      cells: { hours: "0,00", arrival: "", leaving: "" },
    });
  });

  it("does not count days before the start date, and keeps 0-hour days out of the distribution", () => {
    const sheet = build({ entries: [entry("2026-10-01", 3 * 3600)], startDate: "2026-10-28", zeroDays: ["2026-10-29"] });
    expect(sheet.missingDays).toEqual([]);
    expect(sheet.startDateDistribution!.toDates).toEqual(["2026-10-28", "2026-10-30"]);
    expect(day(sheet, "2026-10-29").cells.hours).toBe("0,00");
  });

  it("validates 0-hour days", () => {
    expect(() => build({ month: "2026-10", zeroDays: ["2026-10-03"] })).toThrow(/falls on a weekend day/);
    expect(() => build({ entries: [entry("2026-10-05", 60)], zeroDays: ["2026-10-05"] })).toThrow(/has 0,02 tracked hours/);
    expect(() =>
      build({ month: "2026-10", zeroDays: ["2026-10-05"], leave: [{ date: "2026-10-05", label: "Szabadság" }] }),
    ).toThrow(InputError);
    expect(() => build({ month: "2026-10", zeroDays: ["2026-11-02"] })).toThrow(/outside 2026-10/);
  });
});
