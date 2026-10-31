import { defaultOutputName, type AttendanceSheet } from "@attendance/core";
import type { PdfFonts } from "@attendance/pdf";
import boldUrl from "@attendance/pdf/fonts/DejaVuSans-Bold.ttf?url";
import regularUrl from "@attendance/pdf/fonts/DejaVuSans.ttf?url";

let fonts: Promise<PdfFonts> | undefined;

function loadFonts(): Promise<PdfFonts> {
  const fetchFont = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
  fonts ??= Promise.all([fetchFont(regularUrl), fetchFont(boldUrl)]).then(([regular, bold]) => ({ regular, bold }));
  return fonts;
}

/** Renders the PDF in the browser and hands it to the user as a download. */
export async function downloadPdf(sheet: AttendanceSheet): Promise<void> {
  // pdfkit is large; load it only when a PDF is actually requested.
  const [{ renderAttendancePdf }, fonts] = await Promise.all([import("@attendance/pdf"), loadFonts()]);
  const bytes = await renderAttendancePdf(sheet, fonts);
  saveFile(new Blob([bytes.slice()], { type: "application/pdf" }), defaultOutputName(sheet));
}

export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
