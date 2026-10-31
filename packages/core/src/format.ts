// All rounding is integer arithmetic on seconds, so 3.945 h rounds to 3.95
// instead of falling victim to binary floating point.

/** Hours in hundredths, rounded half up: 14202 s (3.945 h) -> 395. */
export function secondsToHundredths(seconds: number): number {
  return Math.floor((seconds * 100 + 1800) / 3600);
}

/** Whole minutes, rounded half up: 7:29:30 -> 450. */
export function secondsToMinutes(seconds: number): number {
  return Math.floor((seconds + 30) / 60);
}

/** 460 -> "4,60" */
export function formatHundredths(hundredths: number): string {
  const sign = hundredths < 0 ? "-" : "";
  const abs = Math.abs(hundredths);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Minutes after midnight -> "9:00", "13:36" */
export function formatClock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "9:00" or "09:00" -> minutes after midnight, or null if invalid. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** "h:mm:ss" (hours may exceed 23) -> seconds, or null if invalid. */
export function parseDuration(value: string): number | null {
  const m = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** "2026-10-01" -> "2026.10.01." */
export function formatDateHu(date: string): string {
  return `${date.replaceAll("-", ".")}.`;
}
