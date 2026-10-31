import { InputError, WEEKEND_POLICIES, WeekendPolicyError } from "@attendance/core";
import { Command, CommanderError } from "commander";
import { generate, type GenerateFlags } from "./generate.ts";

export const EXIT_OK = 0;
export const EXIT_INVALID_INPUT = 1;
export const EXIT_WEEKEND_REJECTED = 2;

export interface Io {
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

/** Parses `argv` (without the node and script entries) and runs the command. Returns the exit code. */
export async function run(argv: string[], io: Io): Promise<number> {
  let exitCode = EXIT_OK;
  const program = new Command("attendance")
    .description("Hungarian monthly attendance sheet (jelenléti ív) from a Toggl Track detailed CSV export")
    .exitOverride()
    .configureOutput({ writeOut: (s) => io.out(s.trimEnd()), writeErr: (s) => io.err(s.trimEnd()) });

  program
    .command("generate")
    .description("Generate a one-page A4 PDF for one employee and one month")
    .requiredOption("--csv <file>", "Toggl Track detailed report CSV export")
    .requiredOption("--employee <name>", "employee name as printed on the sheet")
    .option("--base-hours <hours>", "monthly minimum hours (default: defaults.baseHours in the config)")
    .option("--month <YYYY-MM>", "month to generate (default: inferred from the CSV)")
    .option("--leave <date=label>", "leave day, e.g. 2026-10-16=Szabadság (repeatable)", collect, [])
    .option("--zero-day <date>", "workday without tracked time confirmed as 0 hours (repeatable)", collect, [])
    .option("--config <file>", "employer config JSON (default: ./employer.json, else the project's employer.json)")
    .option("--out <file>", "output PDF (default: Jelenleti_iv_<Name>_<YYYY>_<MM>.pdf)")
    .option("--arrival <H:MM>", "arrival time on worked days (default: 9:00)")
    .option("--weekend-policy <policy>", `hours on non-working days: ${WEEKEND_POLICIES.join(" | ")} (default: redistribute)`)
    .option("--place <city>", "place in the 'Kelt:' line (default: employer city)")
    .option(
      "--start-date <YYYY-MM-DD>",
      "employment start within the month: divide all hours over the workdays from this date on",
    )
    .option("--max-daily-hours <hours>", "daily cap with --start-date (default: 8); the rest is reported, not printed")
    .action(async (flags: GenerateFlags) => {
      const { outPath, sheet } = await generate(flags, io.cwd);
      for (const warning of sheet.warnings) io.err(`Warning: ${warning}`);
      for (const note of sheet.notes) io.out(`Note: ${note}`);
      io.out(`Wrote ${outPath}`);
      io.out(
        `${sheet.employee}, ${sheet.period}: ${sheet.totals.total} óra (alapóra ${sheet.totals.base}, többletóra ${sheet.totals.extra})`,
      );
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      // Help and version exit with 0; usage errors (missing option, unknown flag) count as invalid input.
      exitCode = error.exitCode === 0 ? EXIT_OK : EXIT_INVALID_INPUT;
    } else if (error instanceof WeekendPolicyError) {
      io.err(`Error: ${error.message}`);
      exitCode = EXIT_WEEKEND_REJECTED;
    } else if (error instanceof InputError) {
      io.err(`Error: ${error.message}`);
      exitCode = EXIT_INVALID_INPUT;
    } else {
      throw error;
    }
  }
  return exitCode;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
