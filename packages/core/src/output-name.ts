import type { AttendanceSheet } from "./sheet.ts";

/** "Teszt Elek", 2026-10 -> "Jelenleti_iv_Teszt_Elek_2026_10.pdf" */
export function defaultOutputName(sheet: Pick<AttendanceSheet, "employee" | "year" | "month">): string {
  const name = sheet.employee
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `Jelenleti_iv_${name}_${sheet.year}_${String(sheet.month).padStart(2, "0")}.pdf`;
}
