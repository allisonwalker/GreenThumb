import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  daysBetween,
  localDateString,
  localDateTimeString,
  zonedDateTimeToUtc,
} from "./local-date";

describe("garden local date helpers", () => {
  it("keeps a late Pacific evening on the same local date after UTC midnight", () => {
    // 2026-08-09 01:30 UTC == 2026-08-08 18:30 America/Los_Angeles
    const instant = new Date("2026-08-09T01:30:00.000Z");
    expect(localDateString(instant, "America/Los_Angeles")).toBe("2026-08-08");
  });

  it("handles a spring-forward DST day without shifting the calendar date", () => {
    const instant = new Date("2026-03-08T10:00:00.000Z");
    expect(localDateString(instant, "America/Los_Angeles")).toBe("2026-03-08");
  });

  it("adds calendar days and counts spans in whole days", () => {
    expect(addCalendarDays("2026-08-08", -7)).toBe("2026-08-01");
    expect(addCalendarDays("2026-08-08", 7)).toBe("2026-08-15");
    expect(daysBetween("2026-06-01", "2026-08-08")).toBe(68);
  });

  it("converts a late Pacific evening to the following UTC morning", () => {
    const instant = zonedDateTimeToUtc(
      "2026-08-08T21:30",
      "America/Los_Angeles",
    );
    expect(instant.toISOString()).toBe("2026-08-09T04:30:00.000Z");
    expect(localDateTimeString(instant, "America/Los_Angeles")).toBe(
      "2026-08-08T21:30",
    );
  });

  it("rejects a spring-forward gap that is not a real local time", () => {
    expect(() =>
      zonedDateTimeToUtc("2026-03-08T02:30", "America/Los_Angeles"),
    ).toThrow("not a valid local time");
  });
});
