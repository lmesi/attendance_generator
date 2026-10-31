import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildAttendanceSheet,
  defaultOutputName,
  InputError,
  parseLeaveSpec,
  parseTogglCsv,
  type AttendanceSheet,
  type WeekendPolicy,
} from "@attendance/core";
import { renderAttendancePdf } from "@attendance/pdf";
import { loadBundledFonts } from "@attendance/pdf/node";
import { DEFAULT_CONFIG_FILE, loadConfig } from "./config.ts";

export interface GenerateFlags {
  csv: string;
  employee: string;
  baseHours?: string;
  month?: string;
  leave?: string[];
  zeroDay?: string[];
  config?: string;
  out?: string;
  arrival?: string;
  weekendPolicy?: string;
  startDate?: string;
  maxDailyHours?: string;
}

export interface GenerateResult {
  outPath: string;
  sheet: AttendanceSheet;
}

/** Runs the whole pipeline. Relative paths resolve against `cwd`. Flags win over the config file. */
export async function generate(flags: GenerateFlags, cwd: string): Promise<GenerateResult> {
  const config = loadConfig(flags.config && resolve(cwd, flags.config), resolve(cwd, DEFAULT_CONFIG_FILE));
  const defaults = config.defaults ?? {};

  const baseHours = flags.baseHours !== undefined ? parseHours(flags.baseHours, "--base-hours") : defaults.baseHours;
  if (baseHours === undefined) throw new InputError("Base hours are required: pass --base-hours or set defaults.baseHours.");

  const csvPath = resolve(cwd, flags.csv);
  let csvText: string;
  try {
    csvText = readFileSync(csvPath, "utf8");
  } catch (error) {
    throw new InputError(`Cannot read CSV file ${csvPath}: ${(error as Error).message}`);
  }

  const sheet = buildAttendanceSheet({
    entries: parseTogglCsv(csvText),
    employee: flags.employee,
    employer: config.employer,
    baseHours,
    month: flags.month,
    leave: (flags.leave ?? []).flatMap((spec) => spec.split(",")).map(parseLeaveSpec),
    zeroDays: (flags.zeroDay ?? []).flatMap((spec) => spec.split(",")).map((date) => date.trim()),
    arrival: flags.arrival ?? defaults.arrival,
    weekendPolicy: (flags.weekendPolicy ?? defaults.weekendPolicy) as WeekendPolicy | undefined,
    startDate: flags.startDate,
    maxDailyHours:
      flags.maxDailyHours !== undefined ? parseHours(flags.maxDailyHours, "--max-daily-hours") : defaults.maxDailyHours,
  });

  // Every workday needs hours, a leave day or an explicit 0 before the sheet can be signed.
  if (sheet.missingDays.length > 0) {
    const first = sheet.missingDays[0];
    throw new InputError(
      `No hours on ${sheet.missingDays.length} workday(s): ${sheet.missingDays.join(", ")}. ` +
        `Mark each as leave (--leave ${first}=Szabadság or ${first}=Betegszabadság) or as a 0-hour day (--zero-day ${first}).`,
    );
  }

  const pdf = await renderAttendancePdf(sheet, loadBundledFonts());
  const outPath = resolve(cwd, flags.out ?? defaultOutputName(sheet));
  writeFileSync(outPath, pdf);
  return { outPath, sheet };
}

function parseHours(value: string, flag: string): number {
  const hours = Number(value.replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0) throw new InputError(`${flag} must be a non-negative number, got "${value}".`);
  return hours;
}
