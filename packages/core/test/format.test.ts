import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatHundredths,
  parseClock,
  parseDuration,
  secondsToHundredths,
  secondsToMinutes,
  splitEvenly,
  splitProportionally,
} from "../src/index.ts";

describe("rounding", () => {
  it("rounds hours half up to hundredths without floating point error", () => {
    expect(secondsToHundredths(14202)).toBe(395); // 3:56:42 = 3.945 h
    expect(secondsToHundredths(16565)).toBe(460);
    expect(secondsToHundredths(17)).toBe(0); // 0.0047 h
    expect(secondsToHundredths(18)).toBe(1); // 0.005 h
  });

  it("rounds minutes half up", () => {
    expect(secondsToMinutes(4 * 3600 + 36 * 60 + 5)).toBe(276);
    expect(secondsToMinutes(7 * 3600 + 29 * 60 + 30)).toBe(450);
    expect(secondsToMinutes(29)).toBe(0);
  });
});

describe("formatting and parsing", () => {
  it("uses a decimal comma", () => {
    expect(formatHundredths(460)).toBe("4,60");
    expect(formatHundredths(10449)).toBe("104,49");
    expect(formatHundredths(5)).toBe("0,05");
  });

  it("formats and parses clock times", () => {
    expect(formatClock(9 * 60)).toBe("9:00");
    expect(formatClock(13 * 60 + 36)).toBe("13:36");
    expect(parseClock("09:00")).toBe(540);
    expect(parseClock("9:00")).toBe(540);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("9")).toBeNull();
  });

  it("parses Toggl durations", () => {
    expect(parseDuration("3:56:42")).toBe(14202);
    expect(parseDuration("25:00:00")).toBe(90000);
    expect(parseDuration("1:60:00")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });
});

describe("splitEvenly", () => {
  it("gives the leftover seconds to the earliest parts", () => {
    expect(splitEvenly(1, 3)).toEqual([1, 0, 0]);
    expect(splitEvenly(11, 4)).toEqual([3, 3, 3, 2]);
    expect(splitEvenly(10800, 5)).toEqual([2160, 2160, 2160, 2160, 2160]);
  });
});

describe("splitProportionally", () => {
  it("follows the weights and hands out leftover seconds by largest remainder", () => {
    expect(splitProportionally(10, [1, 1, 1], 100)).toEqual([4, 3, 3]);
    expect(splitProportionally(100, [1, 3], 100)).toEqual([25, 75]);
  });

  it("caps a part and shares its excess among the others", () => {
    expect(splitProportionally(30, [9, 1, 5, 5, 5], 8)).toEqual([8, 1, 7, 7, 7]);
    expect(splitProportionally(30, [9, 1, 5, 5, 5], 8).reduce((a, b) => a + b)).toBe(30);
  });

  it("gives everyone the cap when the total does not fit", () => {
    expect(splitProportionally(100, [1, 2, 3], 10)).toEqual([10, 10, 10]);
  });

  it("splits evenly when all weights are zero", () => {
    expect(splitProportionally(7, [0, 0, 0], 10)).toEqual([3, 2, 2]);
  });
});
