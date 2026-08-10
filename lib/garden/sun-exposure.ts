export const SUN_EXPOSURES = [
  "full_sun",
  "part_sun",
  "part_shade",
  "full_shade",
] as const;

export type SunExposure = (typeof SUN_EXPOSURES)[number];

export type SunZoneInput = {
  startFt: number;
  endFt: number;
  sunExposure: SunExposure;
};

export type SunExposureMix = Partial<
  Record<SunExposure, { feet: number; fraction: number }>
>;

export type DerivedSunExposure = {
  exposure: string;
  label: string;
  mix: SunExposureMix;
};

const EPSILON = 0.000_001;

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= EPSILON;
}

function formatFeet(value: number) {
  return Number.isInteger(value) ? String(value) : String(round(value));
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function validateSunZoneCoverage(
  zones: readonly SunZoneInput[],
  bedLengthFt = 50,
) {
  if (bedLengthFt <= 0) {
    throw new Error("Bed length must be positive.");
  }

  if (zones.length === 0) {
    throw new Error(
      `Sun zones leave a gap from 0 to ${formatFeet(bedLengthFt)} feet.`,
    );
  }

  const sortedZones = [...zones].sort(
    (left, right) => left.startFt - right.startFt,
  );
  let expectedStart = 0;

  for (const zone of sortedZones) {
    if (zone.startFt < -EPSILON || zone.endFt > bedLengthFt + EPSILON) {
      throw new Error(
        `Sun zone ${formatFeet(zone.startFt)}–${formatFeet(zone.endFt)} feet must stay within the 0–${formatFeet(bedLengthFt)} foot bed.`,
      );
    }

    if (zone.endFt <= zone.startFt) {
      throw new Error("Each sun zone must have positive length.");
    }

    if (zone.startFt < expectedStart - EPSILON) {
      throw new Error(
        `Sun zones overlap from ${formatFeet(zone.startFt)} to ${formatFeet(Math.min(expectedStart, zone.endFt))} feet.`,
      );
    }

    if (zone.startFt > expectedStart + EPSILON) {
      throw new Error(
        `Sun zones leave a gap from ${formatFeet(expectedStart)} to ${formatFeet(zone.startFt)} feet.`,
      );
    }

    expectedStart = zone.endFt;
  }

  if (!nearlyEqual(expectedStart, bedLengthFt)) {
    throw new Error(
      `Sun zones leave a gap from ${formatFeet(expectedStart)} to ${formatFeet(bedLengthFt)} feet.`,
    );
  }

  return sortedZones;
}

export function deriveSectionSunExposure(
  sectionStartFt: number,
  sectionEndFt: number,
  zones: readonly SunZoneInput[],
  bedLengthFt = 50,
): DerivedSunExposure {
  if (
    sectionStartFt < 0 ||
    sectionEndFt > bedLengthFt ||
    sectionEndFt <= sectionStartFt
  ) {
    throw new Error("Section boundaries must form an interval within the bed.");
  }

  const sortedZones = validateSunZoneCoverage(zones, bedLengthFt);
  const sectionLength = sectionEndFt - sectionStartFt;
  const feetByExposure = new Map<SunExposure, number>();

  for (const zone of sortedZones) {
    const overlap =
      Math.min(sectionEndFt, zone.endFt) -
      Math.max(sectionStartFt, zone.startFt);

    if (overlap > EPSILON) {
      feetByExposure.set(
        zone.sunExposure,
        (feetByExposure.get(zone.sunExposure) ?? 0) + overlap,
      );
    }
  }

  const coveredLength = [...feetByExposure.values()].reduce(
    (sum, feet) => sum + feet,
    0,
  );

  if (!nearlyEqual(coveredLength, sectionLength)) {
    throw new Error("Sun zones do not fully cover the section.");
  }

  const mix: SunExposureMix = {};
  let dominantExposure: SunExposure | undefined;
  let dominantFeet = 0;

  for (const exposure of SUN_EXPOSURES) {
    const feet = feetByExposure.get(exposure);

    if (feet === undefined) {
      continue;
    }

    mix[exposure] = {
      feet: round(feet),
      fraction: round(feet / sectionLength),
    };

    if (feet > dominantFeet) {
      dominantExposure = exposure;
      dominantFeet = feet;
    }
  }

  if (!dominantExposure) {
    throw new Error("Could not derive sun exposure for the section.");
  }

  if (nearlyEqual(dominantFeet, sectionLength)) {
    return {
      exposure: dominantExposure,
      label: dominantExposure.replaceAll("_", " "),
      mix,
    };
  }

  if (dominantFeet / sectionLength + EPSILON >= 2 / 3) {
    return {
      exposure: `mostly_${dominantExposure}`,
      label: `mostly ${dominantExposure.replaceAll("_", " ")}`,
      mix,
    };
  }

  return {
    exposure: "mixed",
    label: "mixed sun",
    mix,
  };
}
