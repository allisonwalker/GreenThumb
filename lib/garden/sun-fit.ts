import { SUN_EXPOSURES, type SunExposure } from "./sun-exposure";

export function formatSunExposureLabel(exposure: string): string {
  return exposure.replaceAll("_", " ");
}

export function isStoredSunPreference(
  value: string | null | undefined,
): value is SunExposure {
  return (
    typeof value === "string" &&
    (SUN_EXPOSURES as readonly string[]).includes(value)
  );
}

/**
 * Compare catalog `sun_preference` to a location's stored exposure.
 * `null` means skip (missing preference — do not guess).
 * Mixed / mostly-other sections are a mismatch unless they are the crop's
 * preference or `mostly_{preference}`.
 */
export function locationFitsSunPreference(
  sunPreference: string | null | undefined,
  locationExposure: string,
): boolean | null {
  if (!isStoredSunPreference(sunPreference)) {
    return null;
  }

  if (!locationExposure) {
    return null;
  }

  if (locationExposure === sunPreference) {
    return true;
  }

  if (locationExposure === `mostly_${sunPreference}`) {
    return true;
  }

  return false;
}

export function sunMismatchWarning(input: {
  cropLabel: string;
  sunPreference: string | null | undefined;
  locationExposure: string;
}): string | null {
  const fits = locationFitsSunPreference(
    input.sunPreference,
    input.locationExposure,
  );
  if (fits !== false || !isStoredSunPreference(input.sunPreference)) {
    return null;
  }

  return `${input.cropLabel} want ${formatSunExposureLabel(input.sunPreference)}; this location is ${formatSunExposureLabel(input.locationExposure)}. You can still save — this is a warning, not a block.`;
}
