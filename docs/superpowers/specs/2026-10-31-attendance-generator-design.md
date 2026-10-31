# Attendance sheet generator – design decisions

2026-10-31 · builds on the specification "Attendance sheet generator – specification" (Oct 31, 2026, @Mesi).
This file records only the decisions the spec left open or that came up while designing. The spec itself stays the source of truth for everything else.

## Answers to the spec's open questions

1. **Redistribution note** – kept. It is printed only when hours were actually moved, so a normal month shows nothing. A sheet that silently differs from Toggl is worse than one extra line.
2. **Who receives redistributed hours** – only workdays that already have tracked hours (as in the spec). Filling empty `-` days would invent attendance on days the employee did not work.
3. **Place in "Kelt:"** – defaults to `employer.city`, overridable with `--place` (or `defaults.place` in the config). This costs one option and covers a home-office signing.
4. **Web interface** – not built now; the decision gate in the spec stands. The core packages stay free of Node-only APIs so it can be added later.

## Further decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Rounding | All rounding uses integer arithmetic on seconds: hundredths = ⌊(s·100 + 1800) / 3600⌋, minutes = ⌊(s + 30) / 60⌋ | 14202 s = 3.945 h exactly; floating point rounds it to 3.94 |
| Redistribution order | Even split; the remainder seconds go one each to the earliest eligible days | "Largest remainder" with equal weights; stable and testable |
| Moved rest day with hours | Counts as non-working, so its hours are pooled like weekend hours | Consistent with "treated like a weekend day" |
| `keep` policy | Hours and arrival/leaving times are shown on the non-working day; the row stays grey | The grey still marks the day type |
| Leave day with tracked hours | Error (exit 1) | Otherwise tracked time would silently disappear |
| Leave day on a moved rest day | Error, like weekends and holidays | It is not a workday |
| Leave day on a working Saturday | Allowed | It is a workday |
| Leaving time past midnight | Error suggesting an earlier `--arrival` | "24:10" or a wrapped time would be misleading |
| More than one member in the CSV | Error (exit 1) | Multiple employees are out of scope; summing them would be wrong |
| `--month` given, CSV has other months too | Entries outside the month are ignored, with a warning that gives the count | Toggl export ranges may overlap |
| Year without a moved-days data file | Warning; fixed and Easter-based holidays are still applied | Works offline and does not block, but is not silent |
| Time display | `H:MM` without a leading zero (9:00, 13:36) | Matches the spec examples |
| Output name | `Jelenleti_iv_<Name>_<YYYY>_<MM>.pdf`, name folded to ASCII with spaces as `_` (Teszt_Elek) | Matches the spec CLI example |
| Font | DejaVu Sans + Bold bundled in `packages/pdf/fonts` with their license; the renderer takes font bytes as input | Embeds ő/ű; there is no file system in the browser later |
| Display strings | `packages/core` produces both numbers and the formatted cell texts (`4,60`, `Szabadság`, `-`) | A future web preview reuses exactly what the PDF prints |
| Test fixture | An anonymized copy of the October export (descriptions, names, e-mails and projects replaced; durations and times unchanged) is committed | Acceptance tests run from the repo without committing personal data |

## Architecture

pnpm workspace, TypeScript strict, ESM. Packages export their TypeScript source directly. `tsx` runs the CLI, `tsc --noEmit` type-checks, and Vitest runs all tests from the root. There is no build step to keep in sync.

- `packages/calendar-hu`: date helpers (`YYYY-MM-DD` ↔ day number, weekday via `Date.UTC`), fixed and Easter-based holidays (Good Friday, Easter Sunday/Monday, Whit Sunday/Monday), and `data/<year>.json` with the moved days. `dayInfo(date)` returns `workday | weekend | holiday | restday`.
- `packages/core`: `parseTogglCsv(text)` → entries; `buildAttendanceSheet(options)` → `AttendanceSheet` (days with types, seconds and cell texts; totals; redistribution info; warnings). Throws `InputError` (exit 1) or `WeekendPolicyError` (exit 2).
- `packages/pdf`: `renderAttendancePdf(sheet, fonts)` → `Uint8Array` with pdfkit. Absolute positioning only, so it never spills to a second page.
- `apps/cli`: commander `generate` command, zod-validated config, merges flags over config, reads the CSV and fonts, writes the PDF, maps errors to exit codes.

## Testing

- calendar-hu: Easter dates 2026–2030; 2026-01-02 is a rest day (not a holiday); 2026-01-10 is a workday; 2026-10-23 is a holiday.
- core: rounding edge cases; redistribution (3 h Saturday over 5 days → 0.60 h each, total unchanged to the second; 1 s over 3 days → 1, 0, 0); validation errors; the October acceptance table.
- pdf: renders exactly one page for a 31-day month.
- cli: exit codes 0/1/2 for success, missing column, bad duration, mixed months and `reject`.
