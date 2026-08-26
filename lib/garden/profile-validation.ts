import { requireIsoCalendarDate } from "./local-date";
import {
  SUN_EXPOSURES,
  validateSunZoneCoverage,
  type SunExposure,
  type SunZoneInput,
} from "./sun-exposure";

export type GardenProfileInput = {
  latitude: number;
  longitude: number;
  timezone: string;
  hardinessZone: string;
  averageLastFrostOn: string | null;
  averageFirstFrostOn: string | null;
  bedLengthFt: number;
  bedWidthFt: number;
  soilType: string;
  sunZones: SunZoneInput[];
};

export type GardenProfileRecord = GardenProfileInput;

export type GardenProfileFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function requiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function requiredNumber(formData: FormData, name: string, label: string) {
  const rawValue = requiredText(formData, name, label);
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  return value;
}

function optionalDate(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    return null;
  }
  return requireIsoCalendarDate(value, label);
}

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseGardenProfileForm(
  formData: FormData,
): GardenProfileInput {
  const latitude = requiredNumber(formData, "latitude", "Latitude");
  const longitude = requiredNumber(formData, "longitude", "Longitude");
  const timezone = requiredText(formData, "timezone", "Timezone");
  const hardinessZone = requiredText(
    formData,
    "hardinessZone",
    "Hardiness zone",
  );
  const bedLengthFt = requiredNumber(
    formData,
    "bedLengthFt",
    "Bed length",
  );
  const bedWidthFt = requiredNumber(formData, "bedWidthFt", "Bed width");
  const soilType = requiredText(formData, "soilType", "Soil type");

  if (latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }
  if (!isIanaTimezone(timezone)) {
    throw new Error(
      "Timezone must be a valid IANA name, such as America/Los_Angeles.",
    );
  }
  if (bedLengthFt <= 0 || bedWidthFt <= 0) {
    throw new Error("Bed dimensions must be greater than zero.");
  }

  const starts = formData.getAll("zoneStartFt");
  const ends = formData.getAll("zoneEndFt");
  const exposures = formData.getAll("zoneExposure");
  if (starts.length !== ends.length || starts.length !== exposures.length) {
    throw new Error("Each sun zone needs a start, end, and exposure.");
  }

  const sunZones = starts.map((start, index) => {
    const startFt = Number(start);
    const endFt = Number(ends[index]);
    const sunExposure = String(exposures[index]) as SunExposure;

    if (!Number.isFinite(startFt) || !Number.isFinite(endFt)) {
      throw new Error(`Sun zone ${index + 1} needs numeric boundaries.`);
    }
    if (!SUN_EXPOSURES.includes(sunExposure)) {
      throw new Error(`Sun zone ${index + 1} has an invalid exposure.`);
    }
    return { startFt, endFt, sunExposure };
  });

  return {
    latitude,
    longitude,
    timezone,
    hardinessZone,
    averageLastFrostOn: optionalDate(
      formData,
      "averageLastFrostOn",
      "Average last frost",
    ),
    averageFirstFrostOn: optionalDate(
      formData,
      "averageFirstFrostOn",
      "Average first frost",
    ),
    bedLengthFt,
    bedWidthFt,
    soilType,
    sunZones: validateSunZoneCoverage(sunZones, bedLengthFt),
  };
}
