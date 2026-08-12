import { describe, expect, it } from "vitest";

import {
  deriveSectionSunExposure,
  formatSectionSunExposureDisplay,
  validateSectionCoverage,
  validateSunZoneCoverage,
  type SunZoneInput,
} from "./sun-exposure";

const completeSunMap: SunZoneInput[] = [
  { startFt: 0, endFt: 18, sunExposure: "full_sun" },
  { startFt: 18, endFt: 34, sunExposure: "part_sun" },
  { startFt: 34, endFt: 50, sunExposure: "part_shade" },
];

describe("sun-zone coverage", () => {
  it("accepts adjacent zones covering the whole bed", () => {
    expect(validateSunZoneCoverage(completeSunMap)).toEqual(completeSunMap);
  });

  it("rejects overlapping zones", () => {
    expect(() =>
      validateSunZoneCoverage([
        { startFt: 0, endFt: 20, sunExposure: "full_sun" },
        { startFt: 18, endFt: 50, sunExposure: "part_sun" },
      ]),
    ).toThrow("overlap from 18 to 20 feet");
  });

  it("rejects a gap between zones", () => {
    expect(() =>
      validateSunZoneCoverage([
        { startFt: 0, endFt: 18, sunExposure: "full_sun" },
        { startFt: 20, endFt: 50, sunExposure: "part_sun" },
      ]),
    ).toThrow("gap from 18 to 20 feet");
  });
});

describe("section sun-exposure derivation", () => {
  it('weights an 8 ft / 4 ft split as "mostly full sun"', () => {
    const result = deriveSectionSunExposure(10, 22, completeSunMap);

    expect(result).toEqual({
      exposure: "mostly_full_sun",
      label: "mostly full sun",
      mix: {
        full_sun: { feet: 8, fraction: 0.6667 },
        part_sun: { feet: 4, fraction: 0.3333 },
      },
    });
  });

  it("returns one exposure when the section stays inside one zone", () => {
    expect(deriveSectionSunExposure(22, 34, completeSunMap)).toEqual({
      exposure: "part_sun",
      label: "part sun",
      mix: {
        part_sun: { feet: 12, fraction: 1 },
      },
    });
  });

  it("rejects section boundaries outside the bed", () => {
    expect(() =>
      deriveSectionSunExposure(45, 51, completeSunMap),
    ).toThrow("within the bed");
  });
});

describe("section coverage", () => {
  it("accepts adjacent sections covering the bed", () => {
    expect(
      validateSectionCoverage([
        { name: "Section 1", startFt: 0, endFt: 10 },
        { name: "Section 2", startFt: 10, endFt: 22 },
        { name: "Section 3", startFt: 22, endFt: 34 },
        { name: "Section 4", startFt: 34, endFt: 50 },
      ]),
    ).toHaveLength(4);
  });

  it("names the overlapping range in the error", () => {
    expect(() =>
      validateSectionCoverage([
        { name: "Section 1", startFt: 0, endFt: 20 },
        { name: "Section 2", startFt: 18, endFt: 50 },
      ]),
    ).toThrow(/Section 2 \(18–50 ft\).*overlap.*18 to 20/);
  });

  it("names the gap before the next section", () => {
    expect(() =>
      validateSectionCoverage([
        { name: "Section 1", startFt: 0, endFt: 18 },
        { name: "Section 2", startFt: 20, endFt: 50 },
      ]),
    ).toThrow(/gap from 18 to 20 feet before Section 2/);
  });
});

describe("section exposure display", () => {
  it("includes the mix breakdown for straddling sections", () => {
    const derived = deriveSectionSunExposure(10, 22, completeSunMap);
    expect(formatSectionSunExposureDisplay(derived.exposure, derived.mix)).toBe(
      "mostly full sun (8 ft full sun, 4 ft part sun)",
    );
  });

  it("keeps a single-zone label simple", () => {
    expect(
      formatSectionSunExposureDisplay("part_sun", {
        part_sun: { feet: 12, fraction: 1 },
      }),
    ).toBe("part sun");
  });
});
