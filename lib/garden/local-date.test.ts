import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  daysBetween,
  endOfLocalDay,
  localDateString,
  startOfLocalDay,
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

  it("starts the Pacific calendar day at 07:00 UTC during PDT", () => {
    const afternoon = new Date("2026-08-13T22:00:00.000Z");
    expect(startOfLocalDay(afternoon, "America/Los_Angeles").toISOString()).toBe(
      "2026-08-13T07:00:00.000Z",
    );
  });

  it("ends the Pacific calendar day just before the next local midnight", () => {
    expect(endOfLocalDay("2026-08-19", "America/Los_Angeles").toISOString()).toBe(
      "2026-08-20T06:59:59.999Z",
    );
  });
});
