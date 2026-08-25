import { describe, expect, it } from "vitest";

import { lastActionLocalDate, lastCareByLocation } from "./last-care";

const locationId = "11111111-1111-4111-8111-111111111111";
const otherLocationId = "22222222-2222-4222-8222-222222222222";

describe("last care derivation", () => {
  it("treats a late-evening watering as that garden-local day, not the next UTC date", () => {
    const lastWateredOn = lastActionLocalDate(
      [
        {
          locationId,
          actionType: "watered",
          occurredAt: new Date("2026-08-09T04:30:00.000Z"),
          voided: false,
        },
      ],
      locationId,
      "watered",
      "America/Los_Angeles",
    );

    expect(lastWateredOn).toBe("2026-08-08");
  });

  it("ignores a voided watering when deriving last watered", () => {
    const lastWateredOn = lastActionLocalDate(
      [
        {
          locationId,
          actionType: "watered",
          occurredAt: new Date("2026-08-09T04:30:00.000Z"),
          voided: true,
        },
        {
          locationId,
          actionType: "watered",
          occurredAt: new Date("2026-08-06T17:00:00.000Z"),
          voided: false,
        },
      ],
      locationId,
      "watered",
      "America/Los_Angeles",
    );

    expect(lastWateredOn).toBe("2026-08-06");
  });

  it("summarizes last watered and fertilized per location", () => {
    const summary = lastCareByLocation(
      [
        {
          locationId,
          actionType: "watered",
          occurredAt: new Date("2026-08-08T18:00:00.000Z"),
          voided: false,
        },
        {
          locationId,
          actionType: "fertilized",
          occurredAt: new Date("2026-08-01T18:00:00.000Z"),
          voided: false,
        },
        {
          locationId: otherLocationId,
          actionType: "watered",
          occurredAt: new Date("2026-08-07T18:00:00.000Z"),
          voided: false,
        },
      ],
      [locationId, otherLocationId],
      "America/Los_Angeles",
    );

    expect(summary[locationId]).toEqual({
      lastWateredOn: "2026-08-08",
      lastFertilizedOn: "2026-08-01",
    });
    expect(summary[otherLocationId]).toEqual({
      lastWateredOn: "2026-08-07",
      lastFertilizedOn: null,
    });
  });
});
