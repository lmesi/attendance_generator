import { readFileSync } from "node:fs";
import { buildAttendanceSheet, parseTogglCsv, type AttendanceSheet } from "@attendance/core";
import { describe, expect, it } from "vitest";
import { renderAttendancePdf, type PdfFonts } from "../src/index.ts";

const fonts: PdfFonts = {
  regular: readFileSync(new URL("../fonts/DejaVuSans.ttf", import.meta.url)),
  bold: readFileSync(new URL("../fonts/DejaVuSans-Bold.ttf", import.meta.url)),
};

const employer = {
  name: "Nagyon Hosszú Nevű Őrző-Védő és Űrkutató Korlátolt Felelősségű Társaság",
  seat: "1234 Mintaváros, Példa utca 1.",
  taxNumber: "12345678-1-24",
  registrationNumber: "12345678",
  city: "Mintaváros",
};

function pageCount(pdf: Uint8Array): number {
  return (Buffer.from(pdf).toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
}

function octoberSheet(): AttendanceSheet {
  const csv = readFileSync(new URL("../../../fixtures/toggl-2026-10.csv", import.meta.url), "utf8");
  return buildAttendanceSheet({
    entries: parseTogglCsv(csv),
    employee: "Őri Űrsula",
    employer,
    baseHours: 40,
    leave: [{ date: "2026-10-16", label: "Szabadság" }],
  });
}

describe("renderAttendancePdf", () => {
  it("renders a 31-day month on exactly one A4 page", async () => {
    const pdf = await renderAttendancePdf(octoberSheet(), fonts);
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  });

  it("stays on one page with a redistribution note", async () => {
    const sheet = octoberSheet();
    sheet.notes = ["A hétvégi/ünnepnapi 3,50 óra a munkanapok között került elosztásra."];
    expect(pageCount(await renderAttendancePdf(sheet, fonts))).toBe(1);
  });
});
