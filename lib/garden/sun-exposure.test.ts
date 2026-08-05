import { describe, expect, it } from "vitest";

import {
  deriveSectionSunExposure,
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
    ).toThrow("must not overlap");
  });

  it("rejects a gap between zones", () => {
    expect(() =>
      validateSunZoneCoverage([
        { startFt: 0, endFt: 18, sunExposure: "full_sun" },
        { startFt: 20, endFt: 50, sunExposure: "part_sun" },
      ]),
    ).toThrow("without gaps");
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
