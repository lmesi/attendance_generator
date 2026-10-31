import { InputError } from "./errors.ts";
import type { LeaveDay } from "./sheet.ts";

/** "2026-10-16=Szabadság" -> { date: "2026-10-16", label: "Szabadság" } */
export function parseLeaveSpec(spec: string): LeaveDay {
  const separator = spec.indexOf("=");
  if (separator < 0) throw new InputError(`Leave day "${spec}" must look like 2026-10-16=Szabadság.`);
  return { date: spec.slice(0, separator).trim(), label: spec.slice(separator + 1).trim() };
}
