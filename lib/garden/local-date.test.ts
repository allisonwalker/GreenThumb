import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  daysBetween,
  endOfLocalDay,
  gardenLocalToday,
  isIsoCalendarDate,
  localDateString,
  localDateTimeString,
  localDayInterval,
  startOfLocalDay,
  zonedDateTimeToUtc,
} from "./local-date";

describe("garden local date helpers", () => {
  it("keeps a late Pacific evening on the same local date after UTC midnight", () => {
    // 2026-08-09 01:30 UTC == 2026-08-08 18:30 America/Los_Angeles
    const instant = new Date("2026-08-09T01:30:00.000Z");
    expect(localDateString(instant, "America/Los_Angeles")).toBe("2026-08-08");
    expect(
      gardenLocalToday({ timezone: "America/Los_Angeles" }, instant),
    ).toBe("2026-08-08");
  });

  it("changes what counts as today when the garden timezone changes", () => {
    const instant = new Date("2026-08-09T01:30:00.000Z");
    expect(
      gardenLocalToday({ timezone: "America/Los_Angeles" }, instant),
    ).toBe("2026-08-08");
    expect(gardenLocalToday({ timezone: "UTC" }, instant)).toBe("2026-08-09");
    expect(
      gardenLocalToday({ timezone: "Pacific/Auckland" }, instant),
    ).toBe("2026-08-09");
  });

  it("stays on the spring-forward calendar date before and after the gap", () => {
    // 2026-03-08 02:00 never exists in America/Los_Angeles (PST → PDT).
    const beforeGap = new Date("2026-03-08T09:30:00.000Z"); // 01:30 PST
    const afterGap = new Date("2026-03-08T10:30:00.000Z"); // 03:30 PDT
    expect(localDateString(beforeGap, "America/Los_Angeles")).toBe(
      "2026-03-08",
    );
    expect(localDateString(afterGap, "America/Los_Angeles")).toBe("2026-03-08");
    expect(
      startOfLocalDay(afterGap, "America/Los_Angeles").toISOString(),
    ).toBe("2026-03-08T08:00:00.000Z");
  });

  it("keeps both copies of the fall-back hour on the same local date", () => {
    // 2026-11-01 02:00 PDT falls back to 01:00 PST.
    const firstOneThirty = new Date("2026-11-01T08:30:00.000Z"); // 01:30 PDT
    const secondOneThirty = new Date("2026-11-01T09:30:00.000Z"); // 01:30 PST
    expect(localDateString(firstOneThirty, "America/Los_Angeles")).toBe(
      "2026-11-01",
    );
    expect(localDateString(secondOneThirty, "America/Los_Angeles")).toBe(
      "2026-11-01",
    );
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

  it("builds a day interval from local midnight, not UTC noon", () => {
    const lateUtc = new Date("2026-08-09T01:30:00.000Z");
    const { start, end } = localDayInterval(lateUtc, "Pacific/Kiritimati");
    expect(localDateString(lateUtc, "Pacific/Kiritimati")).toBe("2026-08-09");
    expect(start.toISOString()).toBe("2026-08-08T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-09T10:00:00.000Z");
  });

  it("rejects invalid calendar dates", () => {
    expect(isIsoCalendarDate("2026-02-30")).toBe(false);
    expect(isIsoCalendarDate("2026-08-08")).toBe(true);
  });
});
