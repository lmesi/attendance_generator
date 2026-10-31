import { isIsoDate } from "@attendance/calendar-hu";
import { parse } from "csv-parse/sync";
import { InputError } from "./errors.ts";
import { parseDuration } from "./format.ts";

export interface TimeEntry {
  /** Line number in the CSV file (the header is line 1). */
  line: number;
  seconds: number;
  startDate: string;
  startTime: string;
  stopDate: string;
  stopTime: string;
  description: string;
  member: string;
  email: string;
  project: string;
  tags: string;
}

export const REQUIRED_COLUMNS = ["Duration", "Start date", "Start time", "Stop date", "Stop time"] as const;
const OPTIONAL_COLUMNS = ["Description", "Member", "Email", "Project", "Tags"] as const;

interface ParsedRecord {
  record: string[];
  info: { lines: number };
}

/** Parses a Toggl Track "Detailed report" CSV export (UTF-8, optional BOM). */
export function parseTogglCsv(text: string): TimeEntry[] {
  let rows: ParsedRecord[];
  try {
    // With `info: true` each row is { record, info }; the library's typings do not model that.
    rows = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: true, info: true }) as unknown as ParsedRecord[];
  } catch (error) {
    throw new InputError(`The CSV file cannot be read: ${(error as Error).message}`);
  }

  const header = rows[0]?.record.map((name) => name.trim());
  if (!header) throw new InputError("The CSV file is empty.");

  const missing = REQUIRED_COLUMNS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    throw new InputError(`The CSV file is missing required column(s): ${missing.join(", ")}.`);
  }

  const index = Object.fromEntries(
    [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((name) => [name, header.indexOf(name)]),
  ) as Record<(typeof REQUIRED_COLUMNS)[number] | (typeof OPTIONAL_COLUMNS)[number], number>;

  return rows.slice(1).map(({ record, info }) => {
    const line = info.lines;
    const cell = (name: keyof typeof index) => (index[name] >= 0 ? (record[index[name]] ?? "").trim() : "");

    const duration = cell("Duration");
    const seconds = parseDuration(duration);
    if (seconds === null) {
      throw new InputError(`CSV line ${line}, column "Duration": cannot parse "${duration}" (expected h:mm:ss).`);
    }
    const startDate = cell("Start date");
    if (!isIsoDate(startDate)) {
      throw new InputError(`CSV line ${line}, column "Start date": cannot parse "${startDate}" (expected YYYY-MM-DD).`);
    }

    return {
      line,
      seconds,
      startDate,
      startTime: cell("Start time"),
      stopDate: cell("Stop date"),
      stopTime: cell("Stop time"),
      description: cell("Description"),
      member: cell("Member"),
      email: cell("Email"),
      project: cell("Project"),
      tags: cell("Tags"),
    };
  });
}
