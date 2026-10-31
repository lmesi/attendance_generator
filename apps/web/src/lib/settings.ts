import { WEEKEND_POLICIES, type Employer, type WeekendPolicy } from "@attendance/core";

// The project's employer.json is gitignored: a local build starts with it, a public
// build (where the file is absent) starts empty and the user imports it once.
const projectConfig = Object.values(import.meta.glob("../../../../employer.json", { eager: true, import: "default" }))[0];

const EMPLOYER_KEYS = ["name", "seat", "taxNumber", "registrationNumber", "city"] as const;

/** What the browser remembers between visits. The CSV itself is never stored. */
export interface Settings {
  employer: Employer;
  place: string;
  employee: string;
  baseHours: string;
  arrival: string;
  weekendPolicy: WeekendPolicy;
  maxDailyHours: string;
}

const EMPTY_SETTINGS: Settings = {
  employer: { name: "", seat: "", taxNumber: "", registrationNumber: "", city: "" },
  place: "",
  employee: "",
  baseHours: "40",
  arrival: "09:00",
  weekendPolicy: "redistribute",
  maxDailyHours: "8",
};

export const DEFAULT_SETTINGS: Settings = projectConfig
  ? fromConfigJson(JSON.stringify(projectConfig), EMPTY_SETTINGS)
  : EMPTY_SETTINGS;

const STORAGE_KEY = "attendance-generator:settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    // Blank saved employer fields fall back to the default employer.
    const employer = Object.fromEntries(
      EMPLOYER_KEYS.map((key) => [key, saved.employer?.[key]?.trim() || DEFAULT_SETTINGS.employer[key]]),
    ) as unknown as Employer;
    return { ...DEFAULT_SETTINGS, ...saved, employer };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private window, blocked site data); the app still works without it.
  }
}

/** The same employer.json the CLI reads with --config. */
export function toConfigJson(settings: Settings): string {
  const defaults: Record<string, unknown> = {
    baseHours: toNumber(settings.baseHours) ?? 40,
    arrival: settings.arrival,
    weekendPolicy: settings.weekendPolicy,
    maxDailyHours: toNumber(settings.maxDailyHours) ?? 8,
  };
  if (settings.place.trim()) defaults.place = settings.place.trim();
  return `${JSON.stringify({ employer: settings.employer, defaults }, null, 2)}\n`;
}

export function fromConfigJson(text: string, current: Settings): Settings {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const config = raw as { employer?: Record<string, unknown>; defaults?: Record<string, unknown> };
  const employer = config.employer;
  if (!employer || EMPLOYER_KEYS.some((key) => typeof employer[key] !== "string")) {
    throw new Error(`Employer data is missing. Required fields: ${EMPLOYER_KEYS.map((k) => `employer.${k}`).join(", ")}.`);
  }
  const d = config.defaults ?? {};
  return {
    ...current,
    employer: Object.fromEntries(EMPLOYER_KEYS.map((key) => [key, employer[key] as string])) as unknown as Employer,
    place: typeof d.place === "string" ? d.place : current.place,
    baseHours: typeof d.baseHours === "number" ? String(d.baseHours) : current.baseHours,
    arrival: typeof d.arrival === "string" ? d.arrival.padStart(5, "0") : current.arrival,
    weekendPolicy: WEEKEND_POLICIES.includes(d.weekendPolicy as WeekendPolicy)
      ? (d.weekendPolicy as WeekendPolicy)
      : current.weekendPolicy,
    maxDailyHours: typeof d.maxDailyHours === "number" ? String(d.maxDailyHours) : current.maxDailyHours,
  };
}

/** "40", "40,5" or "40.5" -> number; empty or invalid -> undefined. */
export function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
