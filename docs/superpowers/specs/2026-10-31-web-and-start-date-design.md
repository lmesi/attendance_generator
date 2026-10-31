# Web interface and start-date distribution – design decisions

2026-10-31 · follow-up to [the first design notes](2026-10-31-attendance-generator-design.md).

## Request

- A web interface, dark themed, built with shadcn/ui components.
- A new option for a worker whose employment starts on a given date within the month while the Toggl report covers the whole month: divide the month's hours among the workdays from that date to the last workday of the month, at most 8 hours a day. Hours that do not fit are reported to the user and are not put on the sheet.

## Start-date distribution

| Topic | Decision | Why |
| --- | --- | --- |
| Which hours are divided | All hours tracked in the month, wherever they fall (before the start date, weekends, holidays) | "The report is for the whole month" |
| Receiving days | Workdays (including working Saturdays) from the start date to the end of the month, minus leave days | "To the last work day of the month"; leave days count as 0 h |
| Split | Even, in whole seconds with the largest-remainder method, the same as the weekend rule. If the even share is over the cap, every day gets the cap | "Divide" means even; capping an even split fills every day to 8 h |
| Cap | 8 h a day by default; `--max-daily-hours` / `defaults.maxDailyHours` / a web field can change it | The 8 h is a business rule that may change |
| Leftover | Not on the sheet and not in any total. Reported as a warning (CLI stderr) and as a highlighted alert in the web UI | "Reported to me but not added to the attendance" |
| Days before the start date | Arrival, leaving and hours are left empty (no `-`); weekends and holidays are still grey | The worker was not employed yet, so there is nothing to sign |
| Weekend policy | Does not apply in this mode, since the daily Toggl values are replaced entirely | Every tracked hour is already being moved |
| Note under the table | None; the leftover is reported to the user, not printed | The sheet should read as a normal attendance record |
| Start date validation | Must be a valid date inside the month; leave days before it are rejected; no workday from the start date on is an error | Otherwise there is nowhere to put the hours |

## Web interface

- **Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui**, in `apps/web`. The spec proposed Next.js, but the app is entirely client-side with no server, routes or API, so a static Vite build is simpler and can be opened from any static host or `pnpm web`.
- **Dark theme only**: the `dark` class is set on `<html>` and there is no theme switch.
- **Client-side only**: the CSV is read with the File API and processed in the browser by `@attendance/core`; the PDF is rendered in the browser by `@attendance/pdf` (pdfkit's standalone browser build, aliased in Vite) with the bundled DejaVu Sans fonts. Nothing is uploaded.
- **English UI** (changed from Hungarian on request); the PDF stays Hungarian. Leave choices show English names but store the Hungarian labels that are printed.
- **One page, two columns**: on the left, the inputs (CSV, employee, base hours, month, arrival, weekend policy, start date and daily cap, leave days, employer data); on the right, a live preview of the sheet (grey rows, totals, notes), any warnings, a leftover alert and the Download PDF button. The preview recalculates on every change; errors from core show as an alert instead of the preview.
- **Employer data and defaults** are saved in `localStorage`, with an import/export of the same `employer.json` the CLI uses.

## Follow-up: fixed employer and empty workdays

- **Employer**: it does not change, so the project's own `employer.json` is the default for both apps. It is gitignored so the repository can be public; `employer.example.json` holds fake data to copy from. The CLI uses `--config`, else `./employer.json`, else the project's `employer.json`. A local web build starts from it (blank saved fields fall back to it); a build without the file starts empty and the user imports it once. The employer card is a read-only summary with an Edit button.
- **Empty workdays**: a workday (not before the start date) with no hours, no leave and no 0-hour confirmation is *missing* (`sheet.missingDays`). The sheet cannot be exported while any are left: the web page shows a red alert with Szabadság / Betegszabadság / 0 óra per day (and for all at once) and disables the download; the CLI exits with 1 and lists them.
- **0-hour day**: a new day type (`zeroDays` / `--zero-day`) that prints `0,00` with no times, takes no redistributed hours, and is not allowed on non-working days or on days with tracked hours.
- **Preview colours**: red = missing, blue = leave, violet = 0 hours, grey = weekend/holiday/rest day, with a legend. The PDF is unchanged (grey only for non-working days).
- **Left card cropped**: the inner grids had implicit `auto` columns, so a long CSV file name widened the card; they now use `grid-cols-1` (`minmax(0, 1fr)`).

## Follow-up: start-date split follows Toggl

- Leave days and 0-hour days before the start date are ignored instead of rejected; those days are blank on the sheet anyway.
- The split is no longer even: each workday from the start date weighs what Toggl tracked on it, a day with nothing tracked weighs as the average tracked day, and a day whose share would pass the daily cap gets the cap while its excess is shared among the others (`splitProportionally`, whole seconds, largest remainder). When the hours do not fit, every day gets the cap and the leftover is reported, as before.
