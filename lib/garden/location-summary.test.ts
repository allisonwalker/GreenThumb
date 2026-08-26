import { describe, expect, it } from "vitest";

import {
  EMPTY_PLANTING_SUMMARY,
  formatLocationPlantingSummary,
  groupLocationsForGardenDashboard,
} from "./location-summary";

describe("formatLocationPlantingSummary", () => {
  it("says nothing is planted when the location has no current crops", () => {
    expect(formatLocationPlantingSummary([])).toBe(EMPTY_PLANTING_SUMMARY);
  });

  it("uses the crop identity label, including variety when present", () => {
    expect(
      formatLocationPlantingSummary([
        { cropName: "Tomato", variety: "Sungold" },
      ]),
    ).toBe("Tomato / Sungold");
    expect(
      formatLocationPlantingSummary([{ cropName: "Basil", variety: null }]),
    ).toBe("Basil");
  });

  it("lists unique crop labels alphabetically", () => {
    expect(
      formatLocationPlantingSummary([
        { cropName: "Tomato", variety: null },
        { cropName: "Basil", variety: null },
        { cropName: "Tomato", variety: null },
      ]),
    ).toBe("Basil, Tomato");
  });
});

describe("groupLocationsForGardenDashboard", () => {
  it("puts bed sections in a group before pots even if pots arrive first", () => {
    const grouped = groupLocationsForGardenDashboard([
      { id: "pot-1", kind: "pot" as const, name: "Pot 1" },
      { id: "sec-2", kind: "bed_section" as const, name: "Section 2" },
      { id: "sec-1", kind: "bed_section" as const, name: "Section 1" },
      { id: "pot-2", kind: "pot" as const, name: "Pot 2" },
    ]);

    expect(grouped.sections.map((location) => location.name)).toEqual([
      "Section 2",
      "Section 1",
    ]);
    expect(grouped.pots.map((location) => location.name)).toEqual([
      "Pot 1",
      "Pot 2",
    ]);
  });
});
