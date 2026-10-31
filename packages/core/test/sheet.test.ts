import { describe, expect, it } from "vitest";
import { buildAttendanceSheet, InputError, WeekendPolicyError, type BuildOptions } from "../src/index.ts";
import { employer, entry } from "./helpers.ts";

function build(overrides: Partial<BuildOptions>) {
  return buildAttendanceSheet({ entries: [], employee: "Teszt Elek", employer, baseHours: 40, ...overrides });
}

const day = (sheet: ReturnType<typeof build>, date: string) => sheet.days.find((d) => d.date === date)!;

describe("weekend rule", () => {
  // October 2026: Sat 3rd, Mon 5th - Fri 9th.
  const weekdays = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
  const entries = [entry("2026-10-03", 3 * 3600), ...weekdays.map((d) => entry(d, 4 * 3600))];

  it("moves 3.00 h from a Saturday evenly onto 5 worked weekdays", () => {
    const sheet = build({ entries });
    for (const date of weekdays) {
      expect(day(sheet, date).seconds).toBe(4 * 3600 + 2160);
      expect(day(sheet, date).cells.hours).toBe("4,60");
    }
    expect(day(sheet, "2026-10-03")).toMatchObject({ seconds: 0, grey: true });
    expect(day(sheet, "2026-10-03").cells).toMatchObject({ hours: "", arrival: "", leaving: "" });
    expect(sheet.totals.seconds).toBe(23 * 3600);
    expect(sheet.notes).toEqual(["A hétvégi/ünnepnapi 3,00 óra a munkanapok között került elosztásra."]);
    expect(sheet.redistribution).toEqual({ pooledSeconds: 10800, fromDates: ["2026-10-03"], toDates: weekdays });
  });

  it("splits a remainder in date order", () => {
    const sheet = build({
      entries: [entry("2026-10-04", 1), entry("2026-10-05", 3600), entry("2026-10-06", 3600), entry("2026-10-07", 3600)],
    });
    expect(["2026-10-05", "2026-10-06", "2026-10-07"].map((d) => day(sheet, d).seconds - 3600)).toEqual([1, 0, 0]);
  });

  it("never gives hours to empty workdays or leave days", () => {
    const sheet = build({
      entries: [entry("2026-10-03", 3600), entry("2026-10-05", 3600)],
      leave: [{ date: "2026-10-06", label: "Szabadság" }],
    });
    expect(day(sheet, "2026-10-05").seconds).toBe(7200);
    expect(day(sheet, "2026-10-06").seconds).toBe(0);
    expect(day(sheet, "2026-10-07").cells.hours).toBe("-");
  });

  it("pools hours from public holidays", () => {
    const sheet = build({ entries: [entry("2026-10-23", 1800), entry("2026-10-22", 3600)] });
    expect(day(sheet, "2026-10-22").seconds).toBe(5400);
    expect(day(sheet, "2026-10-23").cells.hours).toBe("Munkaszüneti nap");
  });

  it("stops when no workday has hours", () => {
    expect(() => build({ entries: [entry("2026-10-03", 3600)] })).toThrow(/no workday with tracked hours/);
  });

  it("keeps hours on the non-working day with policy keep", () => {
    const sheet = build({ entries, weekendPolicy: "keep" });
    expect(day(sheet, "2026-10-03")).toMatchObject({ seconds: 10800, grey: true });
    expect(day(sheet, "2026-10-03").cells).toMatchObject({ hours: "3,00", arrival: "9:00", leaving: "12:00" });
    expect(sheet.notes).toEqual([]);
  });

  it("lists the offending days with policy reject", () => {
    try {
      build({ entries, weekendPolicy: "reject" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WeekendPolicyError);
      expect((error as WeekendPolicyError).days).toEqual([{ date: "2026-10-03", seconds: 10800 }]);
    }
  });
});

describe("calendar", () => {
  it("greys a moved rest day without labelling it, and treats a working Saturday as a workday", () => {
    const sheet = build({ month: "2026-01" });
    expect(day(sheet, "2026-01-02")).toMatchObject({ type: "restday", grey: true });
    expect(day(sheet, "2026-01-02").cells.hours).toBe("");
    expect(day(sheet, "2026-01-10")).toMatchObject({ type: "workday", grey: false });
    expect(day(sheet, "2026-01-10").cells).toMatchObject({ weekday: "Szombat", hours: "-" });
    expect(day(sheet, "2026-01-01").cells.hours).toBe("Munkaszüneti nap");
  });

  it("warns when a year has no moved-day data", () => {
    expect(build({ month: "2031-03" }).warnings[0]).toMatch(/No moved-day data for 2031/);
  });
});

describe("validation", () => {
  it("requires a month when entries span several months", () => {
    const entries = [entry("2026-09-30", 60), entry("2026-10-01", 60)];
    expect(() => build({ entries })).toThrow(/span more than one month \(2026-09, 2026-10\)/);
    const sheet = build({ entries, month: "2026-10" });
    expect(sheet.totals.seconds).toBe(60);
    expect(sheet.warnings).toContain("1 CSV entry outside 2026-10 ignored.");
  });

  it("rejects leave days on non-working days", () => {
    expect(() => build({ month: "2026-10", leave: [{ date: "2026-10-03", label: "Szabadság" }] })).toThrow(
      /falls on a weekend day/,
    );
    expect(() => build({ month: "2026-10", leave: [{ date: "2026-10-23", label: "Szabadság" }] })).toThrow(
      /falls on a public holiday/,
    );
    expect(() => build({ month: "2026-01", leave: [{ date: "2026-01-02", label: "Szabadság" }] })).toThrow(
      /falls on a moved rest day/,
    );
  });

  it("rejects a leave day that has tracked hours", () => {
    expect(() =>
      build({ entries: [entry("2026-10-05", 3600)], leave: [{ date: "2026-10-05", label: "Szabadság" }] }),
    ).toThrow(InputError);
  });

  it("rejects several members in one CSV", () => {
    expect(() => build({ entries: [entry("2026-10-05", 60), entry("2026-10-06", 60, { email: "b@x.hu" })] })).toThrow(
      /2 members/,
    );
  });

  it("rejects a leaving time past midnight", () => {
    expect(() => build({ entries: [entry("2026-10-05", 16 * 3600)] })).toThrow(/pass midnight/);
  });

  it("caps the base hours at the total", () => {
    const sheet = build({ entries: [entry("2026-10-05", 10 * 3600)] });
    expect(sheet.totals).toMatchObject({ base: "10,00", extra: "0,00", configuredBase: "40,00" });
  });
});
