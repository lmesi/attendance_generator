// English formatting for the web UI. The PDF keeps the Hungarian cell texts from
// @attendance/core; the preview shows the same numbers in English.
import { secondsToHundredths } from "@attendance/core";
import { weekdayIndex } from "@attendance/calendar-hu";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Leave labels are printed in Hungarian; these are their English names for the UI. */
export const LEAVE_LABELS: Record<string, string> = {
  Szabadság: "Paid leave",
  Betegszabadság: "Sick leave",
  Táppénz: "Sick pay",
};

export function leaveLabel(label: string): string {
  return LEAVE_LABELS[label] ?? label;
}

/** 460 -> "4.60" */
export function formatHours(hundredths: number): string {
  return (hundredths / 100).toFixed(2);
}

export function hoursFromSeconds(seconds: number): string {
  return formatHours(secondsToHundredths(seconds));
}

export function weekdayName(date: string): string {
  return WEEKDAYS[weekdayIndex(date)]!;
}

/** "2026-10-01" -> "Thu, 1 Oct 2026" */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return `${weekdayName(date).slice(0, 3)}, ${day} ${MONTHS[month - 1]!.slice(0, 3)} ${year}`;
}

/** 2026, 10 -> "October 2026" */
export function formatPeriod(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}
