# Attendance sheet generator

Turns a Toggl Track "Detailed report" CSV export into a one-page Hungarian monthly attendance sheet (jelenléti ív) PDF.

Design decisions: [first version](docs/superpowers/specs/2026-10-31-attendance-generator-design.md), [web interface and start-date mode](docs/superpowers/specs/2026-10-31-web-and-start-date-design.md).

## Setup

```bash
corepack enable pnpm
pnpm install
cp employer.example.json employer.json   # then fill in the real employer; it is gitignored
```

## Web interface

```bash
pnpm web
```

Opens a dark-themed page at http://localhost:5173: drop the CSV, fill in the employee, check the live preview, download the PDF. Everything runs in the browser; the CSV is never uploaded. The employer is read from your local `employer.json` when present (a public build has none: import the file once on the page, and the browser remembers it). `pnpm web:build` produces a static site in `apps/web/dist`; build it without an `employer.json` if the site will be public, since the file is bundled when present.

Every workday must have hours, a leave day or an explicit 0: workdays without tracked time are listed in a red alert where each is marked Szabadság, Betegszabadság or 0 óra, and the PDF cannot be downloaded until none are left. In the preview, open days are red, leave days blue and 0-hour days violet. `pnpm web:build` produces a static site in `apps/web/dist`.

### Deploy to GitHub Pages

`.github/workflows/pages.yml` runs the tests and the type check, builds the site and publishes it on every push to `main` (or by hand from the Actions tab). One-time setup: in the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. The site is then at `https://<username>.github.io/<repo>/`. CI has no `employer.json`, so the public site carries no employer data; import your `employer.json` once on the page.

## Command line

```bash
pnpm attendance generate \
  --csv ./TogglTrack_Report_Detailed_report_from_10_01_2026_to_10_31_2026.csv \
  --employee "Teszt Elek" \
  --leave 2026-10-16=Szabadság
```

| Flag | Default | |
| --- | --- | --- |
| `--csv <file>` | required | Toggl Track detailed CSV export |
| `--employee <name>` | required | Printed on the sheet (the CSV's Member column is never printed) |
| `--base-hours <hours>` | `defaults.baseHours` | Monthly minimum for the base/extra split |
| `--month <YYYY-MM>` | inferred | Needed only when the CSV spans several months |
| `--leave <date=label>` | none | Repeatable or comma-separated: `Szabadság`, `Betegszabadság`, `Táppénz`, … |
| `--zero-day <date>` | none | Workday without tracked time confirmed as 0 hours (prints `0,00`); repeatable or comma-separated |
| `--config <file>` | `./employer.json`, else the project's `employer.json` | Employer data and defaults |
| `--out <file>` | `Jelenleti_iv_<Name>_<YYYY>_<MM>.pdf` | |
| `--arrival <H:MM>` | `9:00` | Leaving time = arrival + hours worked |
| `--weekend-policy <p>` | `redistribute` | `redistribute`, `keep` or `reject` hours tracked on non-working days |
| `--place <city>` | employer city | Place in the "Kelt:" line |
| `--start-date <YYYY-MM-DD>` | none | Employment started within the month (see below) |
| `--max-daily-hours <hours>` | `8` | Daily cap with `--start-date` |

Flags win over `defaults` in the config file. The run stops (exit 1) while any workday has no hours, no leave and no `--zero-day`; the message lists those days.

**Start within the month.** With `--start-date` (or the "Hónap közbeni kezdés" switch on the web page) all hours tracked in the month are divided over the workdays from the start date to the end of the month in proportion to what Toggl tracked on each of those days (a day with nothing tracked counts as an average day), at most 8 hours a day; a capped day's excess goes to the other days. Days before the start date stay empty, and leave or 0-hour marks on them are ignored. Hours that do not fit are reported (CLI warning, web alert) and are not on the sheet or in any total. The weekend policy does not apply in this mode. Exit codes: `0` success, `1` invalid input, `2` the `reject` policy found hours on non-working days.

## Calendar data

Public holidays (fixed and Easter-based) are computed. Moved working days come from `packages/calendar-hu/data/<year>.json`; add a file there and register it in `packages/calendar-hu/src/moved-days.ts` for a new year. Without it the tool warns and applies the public holidays only.

**Before using it for December 2026:** re-check `2026.json` (see its `note`): a pending bill would make December 24 a public holiday and could cancel the December 12 working Saturday.

## Development

```bash
pnpm test        # Vitest, includes the October 2026 acceptance fixture
pnpm typecheck
```

- `packages/calendar-hu`: Hungarian holidays and moved days
- `packages/core`: CSV parsing and all the rules, pure functions, returns an `AttendanceSheet`
- `packages/pdf`: renders an `AttendanceSheet` with pdfkit and embedded DejaVu Sans
- `apps/cli`: the `generate` command
- `apps/web`: Vite + React + shadcn/ui page (dark theme); aliases pdfkit and csv-parse to their browser builds

`fixtures/toggl-2026-10.csv` is the October 2026 export with descriptions, names, e-mails and projects replaced; durations, dates and times are unchanged.
