import type { AttendanceSheet } from "@attendance/core";
import PDFDocument from "pdfkit";

/** TTF bytes of a font with Hungarian letters (ő, ű), e.g. DejaVu Sans. */
export interface PdfFonts {
  regular: Uint8Array;
  bold: Uint8Array;
}

/** Swap-able renderer boundary: an AttendanceSheet in, PDF bytes out. */
export interface PdfRenderer {
  render(sheet: AttendanceSheet): Promise<Uint8Array>;
}

// A4 portrait in points. Every element is placed at an absolute position and
// pdfkit's page margins are zero, so text can never flow onto a second page.
const PAGE = { width: 595.28, height: 841.89 };
const LEFT = 40;
const RIGHT = PAGE.width - 40;
const WIDTH = RIGHT - LEFT;

const COLUMNS = [
  { title: "Dátum", width: 72, align: "left" },
  { title: "Nap", width: 68, align: "left" },
  { title: "Érkezés", width: 55, align: "center" },
  { title: "Távozás", width: 55, align: "center" },
  { title: "Ledolgozott óra", width: 100, align: "center" },
  { title: "Munkavállaló aláírása", width: WIDTH - 350, align: "center" },
] as const;

const HEADER_ROW_HEIGHT = 20;
const ROW_HEIGHT = 16;
const TABLE_FONT_SIZE = 9;
const CELL_PADDING = 4;
const GREY = "#e3e3e3";
const LINE = "#555555";

export class PdfkitRenderer implements PdfRenderer {
  constructor(private readonly fonts: PdfFonts) {}

  render(sheet: AttendanceSheet): Promise<Uint8Array> {
    return renderAttendancePdf(sheet, this.fonts);
  }
}

export function renderAttendancePdf(sheet: AttendanceSheet, fonts: PdfFonts): Promise<Uint8Array> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    info: {
      Title: `Jelenléti ív – ${sheet.employee} – ${sheet.period}`,
      Author: sheet.employer.name,
      Subject: "Jelenléti ív",
    },
  });
  doc.registerFont("regular", fonts.regular);
  doc.registerFont("bold", fonts.bold);

  const chunks: Uint8Array[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(concat(chunks)));
    doc.on("error", reject);
  });

  let y = drawHeader(doc, sheet, 40);
  y = drawTable(doc, sheet, y + 14);
  y = drawNotes(doc, sheet, y + 6);
  drawTotals(doc, sheet, y + 8);

  doc.end();
  return done;
}

type Doc = PDFKit.PDFDocument;

function text(doc: Doc, value: string, x: number, y: number, options: PDFKit.Mixins.TextOptions = {}): void {
  doc.text(value, x, y, { lineBreak: false, ...options });
}

function drawHeader(doc: Doc, sheet: AttendanceSheet, top: number): number {
  doc.fillColor("black").font("bold").fontSize(16);
  text(doc, "JELENLÉTI ÍV", LEFT, top, { width: WIDTH, align: "center" });

  let y = top + 32;
  const { employer } = sheet;
  const line = { width: WIDTH, ellipsis: true };
  doc.font("regular").fontSize(9.5);
  text(doc, `Munkáltató: ${employer.name}`, LEFT, y, line);
  y += 13;
  text(doc, `Székhely: ${employer.seat}`, LEFT, y, line);
  y += 13;
  text(doc, `Adószám: ${employer.taxNumber}   |   Nyilvántartási szám: ${employer.registrationNumber}`, LEFT, y, line);

  y += 20;
  doc.font("bold").fontSize(11);
  text(doc, `Munkavállaló neve: ${sheet.employee}`, LEFT, y, line);
  y += 15;
  text(doc, `Időszak: ${sheet.period}`, LEFT, y, line);
  return y + 14;
}

function drawTable(doc: Doc, sheet: AttendanceSheet, top: number): number {
  const height = HEADER_ROW_HEIGHT + sheet.days.length * ROW_HEIGHT;

  // Backgrounds first, so the grid lines sit on top.
  doc.rect(LEFT, top, WIDTH, HEADER_ROW_HEIGHT).fill("#cfcfcf");
  sheet.days.forEach((day, i) => {
    if (day.grey) doc.rect(LEFT, top + HEADER_ROW_HEIGHT + i * ROW_HEIGHT, WIDTH, ROW_HEIGHT).fill(GREY);
  });

  doc.fillColor("black").font("bold").fontSize(TABLE_FONT_SIZE);
  let x = LEFT;
  for (const column of COLUMNS) {
    text(doc, column.title, x + CELL_PADDING, top + (HEADER_ROW_HEIGHT - TABLE_FONT_SIZE) / 2 - 1, {
      width: column.width - 2 * CELL_PADDING,
      align: column.align,
    });
    x += column.width;
  }

  doc.font("regular").fontSize(TABLE_FONT_SIZE);
  sheet.days.forEach((day, i) => {
    const rowTop = top + HEADER_ROW_HEIGHT + i * ROW_HEIGHT;
    // Empty data cells print "-"; the signature column always stays blank.
    const dash = (value: string) => value || "-";
    const values = [
      day.cells.date,
      day.cells.weekday,
      dash(day.cells.arrival),
      dash(day.cells.leaving),
      dash(day.cells.hours),
      "",
    ];
    let cellX = LEFT;
    COLUMNS.forEach((column, c) => {
      text(doc, values[c]!, cellX + CELL_PADDING, rowTop + (ROW_HEIGHT - TABLE_FONT_SIZE) / 2 - 1, {
        width: column.width - 2 * CELL_PADDING,
        align: column.align,
        ellipsis: true,
      });
      cellX += column.width;
    });
  });

  doc.strokeColor(LINE).lineWidth(0.5);
  for (let row = 0; row <= sheet.days.length + 1; row++) {
    const lineY = row === 0 ? top : top + HEADER_ROW_HEIGHT + (row - 1) * ROW_HEIGHT;
    doc.moveTo(LEFT, lineY).lineTo(RIGHT, lineY);
  }
  x = LEFT;
  for (const column of [...COLUMNS, null]) {
    doc.moveTo(x, top).lineTo(x, top + height);
    if (column) x += column.width;
  }
  doc.stroke();

  return top + height;
}

function drawNotes(doc: Doc, sheet: AttendanceSheet, top: number): number {
  doc.fillColor("black").font("regular").fontSize(8);
  let y = top;
  for (const note of sheet.notes) {
    text(doc, note, LEFT, y, { width: WIDTH });
    y += 11;
  }
  return y;
}

function drawTotals(doc: Doc, sheet: AttendanceSheet, top: number): number {
  const rows: Array<[string, string]> = [
    ["Havi összes ledolgozott óra", sheet.totals.total],
    [`Ebből alapóra (minimum ${sheet.totals.configuredBase} óra)`, sheet.totals.base],
    ["Ebből többletóra", sheet.totals.extra],
  ];
  const valueRight = LEFT + 330;
  let y = top;
  rows.forEach(([label, value], i) => {
    doc.fillColor("black").font(i === 0 ? "bold" : "regular").fontSize(10);
    text(doc, `${label}:`, LEFT, y);
    doc.font("bold");
    text(doc, `${value} óra`, valueRight - 90, y, { width: 90, align: "right" });
    y += 15;
  });
  return y;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
