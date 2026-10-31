import { describe, expect, it } from "vitest";
import { InputError, parseTogglCsv } from "../src/index.ts";

const HEADER = '"Description","Duration","Member","Email","Project","Tags","Start date","Start time","Stop date","Stop time"';

describe("parseTogglCsv", () => {
  it("parses rows with a BOM and quoted commas", () => {
    const csv = `﻿${HEADER}\n"Meeting, planning","1:02:03","A","a@x.hu","P","-","2026-10-01","08:00:00","2026-10-01","09:02:03"\n`;
    const [entry] = parseTogglCsv(csv);
    expect(entry).toMatchObject({ seconds: 3723, startDate: "2026-10-01", description: "Meeting, planning", line: 2 });
  });

  it("names a missing column", () => {
    const csv = '"Description","Member","Start date","Start time","Stop date","Stop time"\n';
    expect(() => parseTogglCsv(csv)).toThrow(InputError);
    expect(() => parseTogglCsv(csv)).toThrow(/missing required column\(s\): Duration/);
  });

  it("names the line of a bad duration", () => {
    const csv = `${HEADER}\n"x","1:00:00","A","a@x.hu","P","-","2026-10-01","08:00:00","2026-10-01","09:00:00"\n"y","1h","A","a@x.hu","P","-","2026-10-02","08:00:00","2026-10-02","09:00:00"\n`;
    expect(() => parseTogglCsv(csv)).toThrow(/line 3, column "Duration": cannot parse "1h"/);
  });

  it("rejects a bad start date", () => {
    const csv = `${HEADER}\n"x","1:00:00","A","a@x.hu","P","-","10/01/2026","08:00:00","2026-10-01","09:00:00"\n`;
    expect(() => parseTogglCsv(csv)).toThrow(/column "Start date"/);
  });

  it("returns no entries for a header-only file", () => {
    expect(parseTogglCsv(`${HEADER}\n`)).toEqual([]);
  });
});
