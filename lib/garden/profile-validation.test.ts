import { describe, expect, it } from "vitest";

import { parseGardenProfileForm } from "./profile-validation";

function validForm() {
  const form = new FormData();
  form.set("latitude", "45.5231");
  form.set("longitude", "-122.6765");
  form.set("timezone", "America/Los_Angeles");
  form.set("hardinessZone", "8b");
  form.set("bedLengthFt", "50");
  form.set("bedWidthFt", "3");
  form.set("soilType", "Loam");
  form.append("zoneStartFt", "0");
  form.append("zoneEndFt", "18");
  form.append("zoneExposure", "full_sun");
  form.append("zoneStartFt", "18");
  form.append("zoneEndFt", "50");
  form.append("zoneExposure", "part_sun");
  return form;
}

describe("garden profile form validation", () => {
  it("parses a complete garden profile", () => {
    expect(parseGardenProfileForm(validForm())).toEqual({
      latitude: 45.5231,
      longitude: -122.6765,
      timezone: "America/Los_Angeles",
      hardinessZone: "8b",
      averageLastFrostOn: null,
      averageFirstFrostOn: null,
      bedLengthFt: 50,
      bedWidthFt: 3,
      soilType: "Loam",
      sunZones: [
        { startFt: 0, endFt: 18, sunExposure: "full_sun" },
        { startFt: 18, endFt: 50, sunExposure: "part_sun" },
      ],
    });
  });

  it("names the exact gap in the sun map", () => {
    const form = validForm();
    form.delete("zoneEndFt");
    form.append("zoneEndFt", "17");
    form.append("zoneEndFt", "50");

    expect(() => parseGardenProfileForm(form)).toThrow(
      "gap from 17 to 18 feet",
    );
  });

  it("names the exact overlap in the sun map", () => {
    const form = validForm();
    const starts = form.getAll("zoneStartFt");
    form.delete("zoneStartFt");
    form.append("zoneStartFt", String(starts[0]));
    form.append("zoneStartFt", "16");

    expect(() => parseGardenProfileForm(form)).toThrow(
      "overlap from 16 to 18 feet",
    );
  });

  it("rejects invalid coordinates and timezone names", () => {
    const invalidLatitude = validForm();
    invalidLatitude.set("latitude", "91");
    expect(() => parseGardenProfileForm(invalidLatitude)).toThrow(
      "Latitude must be between -90 and 90",
    );

    const invalidTimezone = validForm();
    invalidTimezone.set("timezone", "Pacific time");
    expect(() => parseGardenProfileForm(invalidTimezone)).toThrow(
      "valid IANA name",
    );
  });

  it("rejects calendar dates that roll into another month", () => {
    const form = validForm();
    form.set("averageLastFrostOn", "2026-02-30");

    expect(() => parseGardenProfileForm(form)).toThrow(
      "Average last frost must be a valid date",
    );
  });
});
