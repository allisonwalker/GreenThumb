import { describe, expect, it } from "vitest";

import {
  formatSunExposureLabel,
  locationFitsSunPreference,
  sunMismatchWarning,
} from "./sun-fit";

describe("locationFitsSunPreference", () => {
  it("skips when catalog sun_preference is missing rather than guessing", () => {
    expect(locationFitsSunPreference(null, "part_shade")).toBeNull();
    expect(locationFitsSunPreference(undefined, "full_sun")).toBeNull();
    expect(locationFitsSunPreference("", "full_sun")).toBeNull();
  });

  it("skips when location exposure is missing rather than guessing", () => {
    expect(locationFitsSunPreference("full_sun", "")).toBeNull();
  });

  it("treats an exact match as a fit for pots and uniform sections", () => {
    expect(locationFitsSunPreference("full_sun", "full_sun")).toBe(true);
    expect(locationFitsSunPreference("part_shade", "part_shade")).toBe(true);
  });

  it("treats mostly_{preference} as a fit", () => {
    expect(locationFitsSunPreference("full_sun", "mostly_full_sun")).toBe(true);
  });

  it("flags a full-sun crop in a part-shade section", () => {
    expect(locationFitsSunPreference("full_sun", "part_shade")).toBe(false);
  });

  it("flags mixed sections as a mismatch for a specific preference", () => {
    expect(locationFitsSunPreference("full_sun", "mixed")).toBe(false);
    expect(locationFitsSunPreference("part_sun", "mostly_full_sun")).toBe(
      false,
    );
  });
});

describe("sunMismatchWarning", () => {
  it("names both the location exposure and the crop preference", () => {
    expect(
      sunMismatchWarning({
        cropLabel: "tomatoes",
        sunPreference: "full_sun",
        locationExposure: "part_shade",
      }),
    ).toBe(
      "tomatoes want full sun; this location is part shade. You can still save — this is a warning, not a block.",
    );
  });

  it("produces no warning on a good fit", () => {
    expect(
      sunMismatchWarning({
        cropLabel: "lettuce",
        sunPreference: "part_shade",
        locationExposure: "part_shade",
      }),
    ).toBeNull();
  });

  it("produces no warning when preference is missing", () => {
    expect(
      sunMismatchWarning({
        cropLabel: "basil",
        sunPreference: null,
        locationExposure: "full_sun",
      }),
    ).toBeNull();
  });

  it("formats mixed location labels", () => {
    expect(formatSunExposureLabel("mostly_part_sun")).toBe("mostly part sun");
  });
});
