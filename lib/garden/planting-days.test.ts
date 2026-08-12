import { describe, expect, it } from "vitest";

import { daysBetween, localDateString } from "./local-date";

describe("days since planting (garden-local)", () => {
  it("counts whole local days from planted_on to garden today", () => {
    const plantedOn = "2026-05-01";
    // 2026-07-08 06:00 UTC is still 2026-07-07 evening in America/Los_Angeles.
    const todayLocal = localDateString(
      new Date("2026-07-08T06:00:00.000Z"),
      "America/Los_Angeles",
    );

    expect(todayLocal).toBe("2026-07-07");
    expect(daysBetween(plantedOn, todayLocal)).toBe(67);
  });
});
