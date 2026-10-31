import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAttendanceSheet, parseTogglCsv } from "../src/index.ts";
import { employer } from "./helpers.ts";

const csv = readFileSync(new URL("../../../fixtures/toggl-2026-10.csv", import.meta.url), "utf8");

describe("October 2026 acceptance fixture", () => {
  const entries = parseTogglCsv(csv);
  const sheet = buildAttendanceSheet({
    entries,
    employee: "Teszt Elek",
    employer,
    baseHours: 40,
    leave: [{ date: "2026-10-16", label: "Szabadság" }],
  });
  const cells = (date: string) => sheet.days.find((d) => d.date === date)!.cells;

  it("reads all entries and infers the month", () => {
    expect(entries).toHaveLength(441);
    expect(sheet.period).toBe("2026. október");
    expect(sheet.days).toHaveLength(31);
    expect(sheet.days.filter((d) => d.seconds > 0)).toHaveLength(20);
  });

  it("computes the monthly totals", () => {
    expect(sheet.totals).toMatchObject({ total: "104,49", base: "40,00", extra: "64,49" });
    expect(sheet.redistribution).toBeNull();
    expect(sheet.notes).toEqual([]);
    expect(sheet.warnings).toEqual([]);
    expect(sheet.missingDays).toEqual([]);
  });

  it("computes daily hours and leaving times", () => {
    expect(cells("2026-10-01")).toMatchObject({ date: "2026.10.01.", weekday: "Csütörtök", arrival: "9:00", leaving: "13:36", hours: "4,60" });
    expect(cells("2026-10-02")).toMatchObject({ leaving: "12:57", hours: "3,95" });
    expect(cells("2026-10-06")).toMatchObject({ leaving: "16:30", hours: "7,49" });
  });

  it("shows the leave day and the public holiday", () => {
    expect(cells("2026-10-16")).toEqual({ date: "2026.10.16.", weekday: "Péntek", arrival: "", leaving: "", hours: "Szabadság" });
    expect(sheet.days.find((d) => d.date === "2026-10-23")).toMatchObject({ grey: true, cells: { hours: "Munkaszüneti nap" } });
  });

  it("greys and empties every weekend", () => {
    const weekends = sheet.days.filter((d) => d.cells.weekday === "Szombat" || d.cells.weekday === "Vasárnap");
    expect(weekends).toHaveLength(9);
    for (const d of weekends) expect(d).toMatchObject({ grey: true, cells: { arrival: "", leaving: "", hours: "" } });
  });
});
