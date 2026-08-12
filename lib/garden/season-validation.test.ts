import { describe, expect, it } from "vitest";

import {
  parseCreateSeasonForm,
  parseOverrideSectionForm,
  parseSaveSectionsForm,
} from "./season-validation";

function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        data.append(key, item);
      }
    } else {
      data.append(key, value);
    }
  }
  return data;
}

describe("parseCreateSeasonForm", () => {
  it("marks current when the checkbox value is present", () => {
    expect(
      parseCreateSeasonForm(
        form({
          name: "2026",
          startsOn: "2026-03-01",
          endsOn: "2026-11-01",
          markCurrent: ["false", "true"],
        }),
      ),
    ).toMatchObject({ markCurrent: true, name: "2026" });
  });

  it("leaves markCurrent false when only the hidden value is sent", () => {
    expect(
      parseCreateSeasonForm(
        form({
          name: "Archive",
          startsOn: "2025-03-01",
          endsOn: "2025-11-01",
          markCurrent: "false",
        }),
      ).markCurrent,
    ).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      parseCreateSeasonForm(
        form({
          name: "Bad",
          startsOn: "2026-11-01",
          endsOn: "2026-03-01",
          markCurrent: "true",
        }),
      ),
    ).toThrow("End date must be on or after the start date.");
  });
});

describe("parseSaveSectionsForm", () => {
  it("accepts covering sections for the current season", () => {
    const result = parseSaveSectionsForm(
      form({
        seasonId: "season-1",
        sectionId: ["", ""],
        sectionName: ["A", "B"],
        sectionStartFt: ["0", "25"],
        sectionEndFt: ["25", "50"],
      }),
      50,
    );

    expect(result.sections).toEqual([
      { name: "A", startFt: 0, endFt: 25 },
      { name: "B", startFt: 25, endFt: 50 },
    ]);
  });

  it("surfaces overlap errors with the problem range", () => {
    expect(() =>
      parseSaveSectionsForm(
        form({
          seasonId: "season-1",
          sectionName: ["Left", "Right"],
          sectionStartFt: ["0", "20"],
          sectionEndFt: ["25", "50"],
        }),
        50,
      ),
    ).toThrow(/Right \(20–50 ft\).*overlap/);
  });

  it("rejects duplicate section names", () => {
    expect(() =>
      parseSaveSectionsForm(
        form({
          seasonId: "season-1",
          sectionName: ["Same", "Same"],
          sectionStartFt: ["0", "25"],
          sectionEndFt: ["25", "50"],
        }),
        50,
      ),
    ).toThrow("unique");
  });
});

describe("parseOverrideSectionForm", () => {
  it("requires a known exposure value", () => {
    expect(() =>
      parseOverrideSectionForm(
        form({ sectionId: "sec-1", sunExposure: "mostly_full_sun" }),
      ),
    ).toThrow("valid sun exposure");
  });

  it("accepts a base exposure override", () => {
    expect(
      parseOverrideSectionForm(
        form({ sectionId: "sec-1", sunExposure: "part_shade" }),
      ),
    ).toEqual({ sectionId: "sec-1", sunExposure: "part_shade" });
  });
});
