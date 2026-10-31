import {
  HU_MONTHS,
  dayInfo,
  datesOfMonth,
  hasMovedDaysData,
  isIsoDate,
  parseYearMonth,
  yearMonthOf,
  type DayKind,
} from "@attendance/calendar-hu";
import type { TimeEntry } from "./csv.ts";
import { InputError, WeekendPolicyError } from "./errors.ts";
import {
  formatClock,
  formatDateHu,
  formatHundredths,
  parseClock,
  secondsToHundredths,
  secondsToMinutes,
} from "./format.ts";
import { splitEvenly, splitProportionally } from "./redistribute.ts";

export type WeekendPolicy = "redistribute" | "keep" | "reject";
export const WEEKEND_POLICIES: readonly WeekendPolicy[] = ["redistribute", "keep", "reject"];

export interface Employer {
  name: string;
  seat: string;
  taxNumber: string;
  registrationNumber: string;
  city: string;
}

export interface LeaveDay {
  date: string;
  label: string;
}

export interface BuildOptions {
  entries: TimeEntry[];
  employee: string;
  employer: Employer;
  /** Monthly minimum in hours, e.g. 40. */
  baseHours: number;
  /** "YYYY-MM"; inferred from the entries when omitted. */
  month?: string;
  leave?: LeaveDay[];
  /** Workdays without tracked time confirmed as 0 hours; printed as "0,00". */
  zeroDays?: string[];
  /** Default "9:00". */
  arrival?: string;
  /** Default "redistribute". */
  weekendPolicy?: WeekendPolicy;
  /**
   * Employment start within the month. When set, all hours tracked in the month are
   * divided over the workdays from this date to the end of the month in proportion to
   * what Toggl tracked on each of them, at most `maxDailyHours` a day; the weekend
   * policy does not apply.
   */
  startDate?: string;
  /** Daily cap for the start-date distribution. Default 8. */
  maxDailyHours?: number;
}

export type SheetDayType = DayKind | "leave" | "zero";

export interface SheetDay {
  date: string;
  type: SheetDayType;
  holidayName?: string;
  /** Seconds tracked on this date in the CSV. */
  trackedSeconds: number;
  /** Seconds shown on the sheet, after the weekend policy. */
  seconds: number;
  /** Grey row: weekend, public holiday or rest day. */
  grey: boolean;
  /** Workday without hours that is neither a leave day nor a confirmed 0-hour day. */
  missing: boolean;
  /** Cell texts, exactly as printed. */
  cells: {
    date: string;
    weekday: string;
    arrival: string;
    leaving: string;
    hours: string;
  };
}

export interface Redistribution {
  pooledSeconds: number;
  fromDates: string[];
  toDates: string[];
}

export interface StartDateDistribution {
  startDate: string;
  maxDailySeconds: number;
  pooledSeconds: number;
  placedSeconds: number;
  /** Seconds that did not fit under the daily cap; not on the sheet and not in any total. */
  leftoverSeconds: number;
  /** Leftover hours with decimal comma, e.g. "32,49". */
  leftover: string;
  toDates: string[];
}

export interface AttendanceSheet {
  employer: Employer;
  employee: string;
  year: number;
  month: number;
  /** "2026. október" */
  period: string;
  days: SheetDay[];
  totals: {
    seconds: number;
    totalHundredths: number;
    baseHundredths: number;
    extraHundredths: number;
    configuredBaseHundredths: number;
    /** Cell texts with decimal comma: "104,49", "40,00", "64,49", and the configured base "40,00". */
    total: string;
    base: string;
    extra: string;
    configuredBase: string;
  };
  redistribution: Redistribution | null;
  startDateDistribution: StartDateDistribution | null;
  /** Lines printed under the table. */
  notes: string[];
  /** Problems worth telling the user about that did not stop the run. */
  warnings: string[];
  /**
   * Workdays without hours that still need a decision (leave or 0 hours).
   * The sheet is not final while this is not empty.
   */
  missingDays: string[];
}

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_MAX_DAILY_HOURS = 8;

export function buildAttendanceSheet(options: BuildOptions): AttendanceSheet {
  const warnings: string[] = [];
  const policy = options.weekendPolicy ?? "redistribute";
  if (!WEEKEND_POLICIES.includes(policy)) {
    throw new InputError(`Unknown weekend policy "${policy}" (use ${WEEKEND_POLICIES.join(", ")}).`);
  }

  const employee = options.employee.trim();
  if (!employee) throw new InputError("The employee name is required.");

  if (!Number.isFinite(options.baseHours) || options.baseHours < 0) {
    throw new InputError(`Base hours must be a non-negative number, got "${options.baseHours}".`);
  }
  const configuredBaseHundredths = Math.round(options.baseHours * 100);

  const arrivalText = options.arrival ?? "9:00";
  const arrival = parseClock(arrivalText);
  if (arrival === null) throw new InputError(`Arrival time "${arrivalText}" is not a valid time (expected H:MM).`);

  checkSingleMember(options.entries);

  const yearMonth = resolveMonth(options.entries, options.month);
  const { year, month } = parseYearMonth(yearMonth)!;
  if (!hasMovedDaysData(year)) {
    warnings.push(
      `No moved-day data for ${year}: public holidays are applied, but bridge days and working Saturdays are not.`,
    );
  }

  const tracked = new Map<string, number>();
  let ignored = 0;
  for (const entry of options.entries) {
    // An entry that crosses midnight counts on its start date.
    if (yearMonthOf(entry.startDate) !== yearMonth) {
      ignored++;
      continue;
    }
    tracked.set(entry.startDate, (tracked.get(entry.startDate) ?? 0) + entry.seconds);
  }
  if (ignored > 0) warnings.push(`${ignored} CSV entr${ignored === 1 ? "y" : "ies"} outside ${yearMonth} ignored.`);

  const startDate = options.startDate?.trim() || undefined;
  if (startDate !== undefined) {
    if (!isIsoDate(startDate)) throw new InputError(`Start date "${startDate}" is not a valid date (expected YYYY-MM-DD).`);
    if (yearMonthOf(startDate) !== yearMonth) throw new InputError(`Start date ${startDate} is outside ${yearMonth}.`);
  }

  // In start-date mode every tracked hour is pooled, so hours on a leave day are not lost.
  const leave = validateLeave(options.leave ?? [], yearMonth, tracked, startDate);
  const zeroDays = validateZeroDays(options.zeroDays ?? [], yearMonth, tracked, startDate, leave);

  const days = datesOfMonth(year, month).map((date) => {
    const info = dayInfo(date);
    const seconds = tracked.get(date) ?? 0;
    const beforeStart = startDate !== undefined && date < startDate;
    return { info, leaveLabel: leave.get(date), zero: zeroDays.has(date), beforeStart, trackedSeconds: seconds, seconds };
  });

  let redistribution: Redistribution | null = null;
  let startDateDistribution: StartDateDistribution | null = null;
  if (startDate !== undefined) {
    const maxDailyHours = options.maxDailyHours ?? DEFAULT_MAX_DAILY_HOURS;
    if (!Number.isFinite(maxDailyHours) || maxDailyHours <= 0) {
      throw new InputError(`Max daily hours must be a positive number, got "${maxDailyHours}".`);
    }
    const maxDailySeconds = Math.round(maxDailyHours * 3600);
    const targets = days.filter((d) => !d.beforeStart && d.info.kind === "workday" && !d.leaveLabel && !d.zero);
    if (targets.length === 0) {
      throw new InputError(`There is no workday from ${startDate} to the end of the month to put the hours on.`);
    }
    const pooled = days.reduce((sum, d) => sum + d.trackedSeconds, 0);
    const placed = Math.min(pooled, maxDailySeconds * targets.length);
    // Follow the Toggl pattern: a day weighs what was tracked on it, and a day with
    // nothing tracked counts as an average tracked day so it still gets a share.
    const trackedTargets = targets.filter((d) => d.trackedSeconds > 0);
    const averageTracked = trackedTargets.length
      ? Math.round(trackedTargets.reduce((sum, d) => sum + d.trackedSeconds, 0) / trackedTargets.length)
      : 0;
    const weights = targets.map((d) => d.trackedSeconds || averageTracked);
    for (const d of days) d.seconds = 0;
    splitProportionally(placed, weights, maxDailySeconds).forEach((share, i) => (targets[i]!.seconds = share));
    const leftoverSeconds = pooled - placed;
    startDateDistribution = {
      startDate,
      maxDailySeconds,
      pooledSeconds: pooled,
      placedSeconds: placed,
      leftoverSeconds,
      leftover: formatHundredths(secondsToHundredths(leftoverSeconds)),
      toDates: targets.map((d) => d.info.date),
    };
    if (leftoverSeconds > 0) {
      warnings.push(
        `${startDateDistribution.leftover} hours did not fit (max ${formatHundredths(secondsToHundredths(maxDailySeconds))} hours a day on ${targets.length} workdays from ${startDate}) and are not on the sheet.`,
      );
    }
  }

  // Weekend rule: hours tracked on non-working days.
  const offending =
    startDate === undefined ? days.filter((d) => d.info.kind !== "workday" && d.trackedSeconds > 0) : [];
  if (offending.length > 0 && policy === "reject") {
    const list = offending.map((d) => `${d.info.date} (${formatHundredths(secondsToHundredths(d.trackedSeconds))} óra)`);
    throw new WeekendPolicyError(
      `Hours were tracked on non-working days: ${list.join(", ")}.`,
      offending.map((d) => ({ date: d.info.date, seconds: d.trackedSeconds })),
    );
  }
  if (offending.length > 0 && policy === "redistribute") {
    const targets = days.filter((d) => d.info.kind === "workday" && !d.leaveLabel && d.trackedSeconds > 0);
    if (targets.length === 0) {
      throw new InputError(
        "Hours were tracked on non-working days, but there is no workday with tracked hours to move them to.",
      );
    }
    const pooled = offending.reduce((sum, d) => sum + d.trackedSeconds, 0);
    for (const d of offending) d.seconds = 0;
    splitEvenly(pooled, targets.length).forEach((share, i) => (targets[i]!.seconds += share));
    redistribution = {
      pooledSeconds: pooled,
      fromDates: offending.map((d) => d.info.date),
      toDates: targets.map((d) => d.info.date),
    };
  }

  const sheetDays: SheetDay[] = days.map(({ info, leaveLabel, zero, beforeStart, trackedSeconds, seconds }) => {
    const type: SheetDayType = leaveLabel ? "leave" : zero ? "zero" : info.kind;
    const missing = info.kind === "workday" && !beforeStart && !leaveLabel && !zero && seconds === 0;
    let arrivalCell = "";
    let leavingCell = "";
    let hours = "";

    if (leaveLabel) {
      hours = leaveLabel;
    } else if (zero) {
      hours = formatHundredths(0);
    } else if (seconds > 0) {
      const leaving = arrival + secondsToMinutes(seconds);
      if (leaving >= MINUTES_PER_DAY) {
        throw new InputError(
          `On ${info.date} the leaving time would pass midnight (${formatHundredths(secondsToHundredths(seconds))} óra from ${formatClock(arrival)}); use an earlier arrival time.`,
        );
      }
      arrivalCell = formatClock(arrival);
      leavingCell = formatClock(leaving);
      hours = formatHundredths(secondsToHundredths(seconds));
    } else if (info.kind === "holiday") {
      hours = "Munkaszüneti nap";
    } else if (missing) {
      hours = "-";
    }

    return {
      date: info.date,
      type,
      ...(info.holidayName ? { holidayName: info.holidayName } : {}),
      trackedSeconds,
      seconds,
      grey: info.kind !== "workday",
      missing,
      cells: {
        date: formatDateHu(info.date),
        weekday: info.weekdayName,
        arrival: arrivalCell,
        leaving: leavingCell,
        hours,
      },
    };
  });

  // The total comes from exact seconds, so it may differ by a few hundredths
  // from the sum of the rounded daily values.
  const totalSeconds = sheetDays.reduce((sum, d) => sum + d.seconds, 0);
  const totalHundredths = secondsToHundredths(totalSeconds);
  const baseHundredths = Math.min(totalHundredths, configuredBaseHundredths);
  const extraHundredths = totalHundredths - baseHundredths;

  const notes = redistribution
    ? [
        `A hétvégi/ünnepnapi ${formatHundredths(secondsToHundredths(redistribution.pooledSeconds))} óra a munkanapok között került elosztásra.`,
      ]
    : [];

  return {
    employer: options.employer,
    employee,
    year,
    month,
    period: `${year}. ${HU_MONTHS[month - 1]}`,
    days: sheetDays,
    totals: {
      seconds: totalSeconds,
      totalHundredths,
      baseHundredths,
      extraHundredths,
      configuredBaseHundredths,
      total: formatHundredths(totalHundredths),
      base: formatHundredths(baseHundredths),
      extra: formatHundredths(extraHundredths),
      configuredBase: formatHundredths(configuredBaseHundredths),
    },
    redistribution,
    startDateDistribution,
    notes,
    warnings,
    missingDays: sheetDays.filter((d) => d.missing).map((d) => d.date),
  };
}

function checkSingleMember(entries: TimeEntry[]): void {
  const members = new Set(entries.map((e) => (e.email || e.member).toLowerCase()).filter(Boolean));
  if (members.size > 1) {
    throw new InputError(
      `The CSV contains entries of ${members.size} members (${[...members].join(", ")}); export one employee per file.`,
    );
  }
}

function resolveMonth(entries: TimeEntry[], month: string | undefined): string {
  if (month !== undefined) {
    if (!parseYearMonth(month)) throw new InputError(`Month "${month}" is not valid (expected YYYY-MM).`);
    return month;
  }
  const months = [...new Set(entries.map((e) => yearMonthOf(e.startDate)))].sort();
  if (months.length === 0) throw new InputError("The CSV has no entries, so the month cannot be inferred; pass a month.");
  if (months.length > 1) {
    throw new InputError(`The CSV entries span more than one month (${months.join(", ")}); pass a month to choose one.`);
  }
  return months[0]!;
}

const KIND_NAMES: Record<Exclude<DayKind, "workday">, string> = {
  weekend: "a weekend day",
  holiday: "a public holiday",
  restday: "a moved rest day",
};

function validateZeroDays(
  zeroDays: string[],
  yearMonth: string,
  tracked: Map<string, number>,
  startDate: string | undefined,
  leave: Map<string, string>,
): Set<string> {
  const result = new Set<string>();
  for (const date of zeroDays) {
    if (!isIsoDate(date)) throw new InputError(`0-hour day "${date}" is not a valid date (expected YYYY-MM-DD).`);
    if (yearMonthOf(date) !== yearMonth) throw new InputError(`0-hour day ${date} is outside ${yearMonth}.`);
    const kind = dayInfo(date).kind;
    if (kind !== "workday") throw new InputError(`0-hour day ${date} falls on ${KIND_NAMES[kind]}.`);
    // Days before the start date are blank on the sheet, so a mark there does not matter.
    if (startDate !== undefined && date < startDate) continue;
    if (leave.has(date)) throw new InputError(`${date} is given both as a leave day and as a 0-hour day.`);
    const seconds = tracked.get(date) ?? 0;
    if (seconds > 0 && startDate === undefined) {
      throw new InputError(`0-hour day ${date} has ${formatHundredths(secondsToHundredths(seconds))} tracked hours.`);
    }
    result.add(date);
  }
  return result;
}

function validateLeave(
  leave: LeaveDay[],
  yearMonth: string,
  tracked: Map<string, number>,
  startDate: string | undefined,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const { date, label } of leave) {
    if (!isIsoDate(date)) throw new InputError(`Leave day "${date}" is not a valid date (expected YYYY-MM-DD).`);
    if (!label.trim()) throw new InputError(`Leave day ${date} has no label (e.g. ${date}=Szabadság).`);
    if (yearMonthOf(date) !== yearMonth) throw new InputError(`Leave day ${date} is outside ${yearMonth}.`);
    if (result.has(date)) throw new InputError(`Leave day ${date} is given more than once.`);
    const kind = dayInfo(date).kind;
    if (kind !== "workday") throw new InputError(`Leave day ${date} falls on ${KIND_NAMES[kind]}.`);
    // Days before the start date are blank on the sheet, so a leave day there does not matter.
    if (startDate !== undefined && date < startDate) continue;
    const seconds = tracked.get(date) ?? 0;
    if (seconds > 0 && startDate === undefined) {
      throw new InputError(
        `Leave day ${date} has ${formatHundredths(secondsToHundredths(seconds))} tracked hours; remove the leave day or the entries.`,
      );
    }
    result.set(date, label.trim());
  }
  return result;
}
