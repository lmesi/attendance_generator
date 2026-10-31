import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultOutputName } from "@attendance/core";
import { run } from "../src/run.ts";

const FIXTURE = new URL("../../../fixtures/toggl-2026-10.csv", import.meta.url);
const EXAMPLE_CONFIG = new URL("../../../employer.example.json", import.meta.url);
const HEADER = '"Description","Duration","Member","Email","Project","Tags","Start date","Start time","Stop date","Stop time"';

let dir: string;
let out: string[];
let err: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "attendance-cli-"));
  copyFileSync(EXAMPLE_CONFIG, join(dir, "employer.json"));
  copyFileSync(FIXTURE, join(dir, "october.csv"));
  out = [];
  err = [];
});

const cli = (...args: string[]) =>
  run(["generate", ...args], { cwd: dir, out: (l) => out.push(l), err: (l) => err.push(l) });

function writeCsv(name: string, rows: string[]): string {
  writeFileSync(join(dir, name), [HEADER, ...rows].join("\n"));
  return name;
}

const row = (date: string, duration = "1:00:00") =>
  `"x","${duration}","A","a@x.hu","P","-","${date}","08:00:00","${date}","09:00:00"`;

describe("attendance generate", () => {
  it("writes the October PDF with the default name and exit code 0", async () => {
    const code = await cli("--csv", "october.csv", "--employee", "Teszt Elek", "--leave", "2026-10-16=Szabadság");
    expect(code).toBe(0);
    const pdf = join(dir, "Jelenleti_iv_Teszt_Elek_2026_10.pdf");
    expect(existsSync(pdf)).toBe(true);
    expect(readFileSync(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(out.at(-1)).toBe("Teszt Elek, 2026. október: 104,49 óra (alapóra 40,00, többletóra 64,49)");
  });

  it("lets flags win over the config", async () => {
    await cli("--csv", "october.csv", "--employee", "X", "--base-hours", "100", "--leave", "2026-10-16=Szabadság", "--out", "x.pdf");
    expect(out.at(-1)).toContain("alapóra 100,00, többletóra 4,49");
  });

  it("fails with exit code 1 on a missing column", async () => {
    writeFileSync(join(dir, "bad.csv"), '"Description","Start date"\n"x","2026-10-01"\n');
    expect(await cli("--csv", "bad.csv", "--employee", "X")).toBe(1);
    expect(err.join("\n")).toMatch(/missing required column\(s\): Duration, Start time, Stop date, Stop time/);
  });

  it("fails with exit code 1 on a bad duration", async () => {
    const csv = writeCsv("bad.csv", [row("2026-10-01"), row("2026-10-02", "one hour")]);
    expect(await cli("--csv", csv, "--employee", "X")).toBe(1);
    expect(err.join("\n")).toMatch(/line 3, column "Duration"/);
  });

  it("fails with exit code 1 on mixed months without --month", async () => {
    const csv = writeCsv("mixed.csv", [row("2026-09-30"), row("2026-10-01")]);
    expect(await cli("--csv", csv, "--employee", "X")).toBe(1);
    expect(err.join("\n")).toMatch(/more than one month/);
    // With the month chosen, the run gets past the month check and stops at the empty workdays instead.
    err = [];
    expect(await cli("--csv", csv, "--employee", "X", "--month", "2026-10")).toBe(1);
    expect(err.join("\n")).toMatch(/No hours on 20 workday\(s\)/);
  });

  it("refuses workdays without hours and names them", async () => {
    const csv = writeCsv("tail.csv", [row("2026-10-26"), row("2026-10-27"), row("2026-10-28")]);
    expect(await cli("--csv", csv, "--employee", "X", "--out", "t.pdf")).toBe(1);
    expect(err.join("\n")).toMatch(/No hours on 18 workday\(s\): 2026-10-01, 2026-10-02, 2026-10-05/);
    expect(existsSync(join(dir, "t.pdf"))).toBe(false);
  });

  it("accepts --leave and --zero-day for the missing workdays", async () => {
    const worked = ["01", "02", "05", "06", "07", "08", "09", "12", "13", "14", "15", "16", "19", "20", "21", "22", "26", "27", "28"];
    const csv = writeCsv("almost.csv", worked.map((d) => row(`2026-10-${d}`)));
    expect(await cli("--csv", csv, "--employee", "X", "--out", "a.pdf")).toBe(1);
    expect(err.join("\n")).toMatch(/No hours on 2 workday\(s\): 2026-10-29, 2026-10-30/);
    expect(
      await cli("--csv", csv, "--employee", "X", "--out", "a.pdf", "--leave", "2026-10-29=Betegszabadság", "--zero-day", "2026-10-30"),
    ).toBe(0);
  });

  it("fails with exit code 1 on a leave day on a holiday", async () => {
    expect(await cli("--csv", "october.csv", "--employee", "X", "--leave", "2026-10-23=Szabadság")).toBe(1);
  });

  it("fails with exit code 2 when the reject policy finds weekend hours", async () => {
    const csv = writeCsv("weekend.csv", [row("2026-10-02"), row("2026-10-03")]);
    expect(await cli("--csv", csv, "--employee", "X", "--weekend-policy", "reject")).toBe(2);
    expect(err.join("\n")).toMatch(/2026-10-03 \(1,00 óra\)/);
  });

  it("divides the hours from a start date and reports the leftover", async () => {
    expect(await cli("--csv", "october.csv", "--employee", "X", "--start-date", "2026-10-19", "--out", "x.pdf")).toBe(0);
    expect(err).toContain(
      "Warning: 32,49 hours did not fit (max 8,00 hours a day on 9 workdays from 2026-10-19) and are not on the sheet.",
    );
    expect(out.at(-1)).toBe("X, 2026. október: 72,00 óra (alapóra 40,00, többletóra 32,00)");
  });

  it("fails with exit code 1 when the given config file is missing", async () => {
    expect(await cli("--csv", "october.csv", "--employee", "X", "--config", "missing.json")).toBe(1);
  });

  it("fails with exit code 1 when a required flag is missing", async () => {
    expect(await cli("--csv", "october.csv")).toBe(1);
  });
});

describe("defaultOutputName", () => {
  it("folds Hungarian letters to ASCII", () => {
    expect(defaultOutputName({ employee: "Őri Űrsula", year: 2026, month: 3 })).toBe("Jelenleti_iv_Ori_Ursula_2026_03.pdf");
  });
});
