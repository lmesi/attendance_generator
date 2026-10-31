import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { InputError, WEEKEND_POLICIES } from "@attendance/core";
import { z } from "zod";

const text = z.string().trim().min(1);

export const ConfigSchema = z
  .object({
    employer: z
      .object({
        name: text,
        seat: text,
        taxNumber: text,
        registrationNumber: text,
        city: text,
      })
      .strict(),
    defaults: z
      .object({
        baseHours: z.number().nonnegative().optional(),
        arrival: z.string().optional(),
        weekendPolicy: z.enum(WEEKEND_POLICIES as [string, ...string[]]).optional(),
        maxDailyHours: z.number().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG_FILE = "employer.json";

/** The project's own employer.json (gitignored), shared with the web app; used when no other config is found. */
export const PROJECT_CONFIG_PATH = fileURLToPath(new URL("../../../employer.json", import.meta.url));

/**
 * Reads and validates a config file: the explicit path if given, else `localPath`
 * (./employer.json where the command runs), else the project's employer.json.
 */
export function loadConfig(path: string | undefined, localPath: string): Config {
  const file = path ?? [localPath, PROJECT_CONFIG_PATH].find((candidate) => existsSync(candidate));
  if (!file) {
    throw new InputError(
      "Employer data is required: copy employer.example.json to employer.json and fill it in, or pass --config <file>.",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new InputError(`Cannot read config file ${file}: ${(error as Error).message}`);
  }
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new InputError(`Config file ${file} is invalid:\n  ${issues.join("\n  ")}`);
  }
  return result.data;
}
