import type { Employer, TimeEntry } from "../src/index.ts";

export const employer: Employer = {
  name: "Teszt Kft.",
  seat: "1234 Mintaváros, Fő utca 1.",
  taxNumber: "12345678-1-24",
  registrationNumber: "12345678",
  city: "Mintaváros",
};

let line = 1;

export function entry(startDate: string, seconds: number, extra: Partial<TimeEntry> = {}): TimeEntry {
  return {
    line: ++line,
    seconds,
    startDate,
    startTime: "08:00:00",
    stopDate: startDate,
    stopTime: "09:00:00",
    description: "",
    member: "Teszt Elek",
    email: "teszt@example.com",
    project: "",
    tags: "",
    ...extra,
  };
}
