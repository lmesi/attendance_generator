/** Bad CSV, options or config. The CLI exits with code 1. */
export class InputError extends Error {
  override name = "InputError";
}

export interface OffendingDay {
  date: string;
  seconds: number;
}

/** Hours on non-working days while the weekend policy is "reject". The CLI exits with code 2. */
export class WeekendPolicyError extends Error {
  override name = "WeekendPolicyError";

  constructor(
    message: string,
    readonly days: OffendingDay[],
  ) {
    super(message);
  }
}
