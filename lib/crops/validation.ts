import { SUN_EXPOSURES, type SunExposure } from "@/lib/garden/sun-exposure";

import { catalogSlug, normalizeVariety } from "./slug";
import {
  MINUTES_MAX,
  MINUTES_MIN,
  TIME_ESTIMATE_ACTIONS,
  type CropPruning,
  type CropTimeEstimates,
  type TimeEstimateAction,
} from "./types";

export type CropFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; existingCropId?: string };

export type CreateStubCropInput = {
  name: string;
  variety: string | null;
};

/** Care fields that matching reads — shared by catalog edit and Gemini draft. */
export type CropCareFields = {
  wateringIntervalDays: number | null;
  fertilizingIntervalDays: number | null;
  pruning: CropPruning | null;
  frostSensitive: boolean | null;
  sunPreference: SunExposure | null;
  plantWindowStart: string | null;
  plantWindowEnd: string | null;
  daysToHarvestMin: number | null;
  daysToHarvestMax: number | null;
  timeEstimates: CropTimeEstimates;
  notes: string | null;
};

export type CropEditInput = {
  id: string;
  name: string;
  variety: string | null;
} & CropCareFields;

function requiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optionalPositiveInteger(
  formData: FormData,
  name: string,
  label: string,
) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) {
    return null;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${label} must be a whole number.`);
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }

  return value;
}

function optionalMinutes(formData: FormData, name: string, label: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) {
    return null;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${label} must be a whole number of minutes.`);
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < MINUTES_MIN || value > MINUTES_MAX) {
    throw new Error(
      `${label} must be between ${MINUTES_MIN} and ${MINUTES_MAX} minutes.`,
    );
  }

  return value;
}

function optionalMonthDay(formData: FormData, name: string, label: string) {
  const value = optionalText(formData, name);
  if (!value) {
    return null;
  }

  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    throw new Error(`${label} must be a month-day like 05-15.`);
  }

  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(3, 5));
  const parsed = new Date(Date.UTC(2024, month - 1, day));
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${label} must be a real calendar day.`);
  }

  return value;
}

function parseFrostSensitive(formData: FormData): boolean | null {
  const raw = String(formData.get("frostSensitive") ?? "").trim();
  if (!raw) {
    return null;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new Error("Frost sensitive must be yes or no.");
}

function parseSunPreference(formData: FormData): SunExposure | null {
  const raw = String(formData.get("sunPreference") ?? "").trim();
  if (!raw) {
    return null;
  }
  if (!(SUN_EXPOSURES as readonly string[]).includes(raw)) {
    throw new Error("Sun preference is not a known value.");
  }
  return raw as SunExposure;
}

function parsePruning(formData: FormData): CropPruning | null {
  const raw = String(formData.get("pruning") ?? "").trim();
  if (!raw) {
    return null;
  }
  if (raw === "none") {
    return { needed: false };
  }
  if (raw !== "needed") {
    throw new Error("Pruning must be none, needed, or left blank.");
  }

  const intervalDays = optionalPositiveInteger(
    formData,
    "pruningIntervalDays",
    "Pruning interval",
  );
  const notes = optionalText(formData, "pruningNotes");

  return { needed: true, intervalDays, notes };
}

function parseTimeEstimates(formData: FormData): CropTimeEstimates {
  const estimates: CropTimeEstimates = {};

  for (const action of TIME_ESTIMATE_ACTIONS) {
    const field = `minutes_${action}`;
    const label =
      action === "observed"
        ? "Frost cover (observe) minutes"
        : action === "treated"
          ? "Frost cover (treat) minutes"
          : `${capitalize(action)} minutes`;
    const value = optionalMinutes(formData, field, label);
    if (value !== null) {
      estimates[action as TimeEstimateAction] = value;
    }
  }

  return estimates;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function parseCreateStubCropForm(
  formData: FormData,
): CreateStubCropInput {
  const name = requiredText(formData, "name", "Crop name");
  const variety = normalizeVariety(optionalText(formData, "variety"));
  catalogSlug(name, variety);
  return { name, variety };
}

export function parseCropEditForm(formData: FormData): CropEditInput {
  const id = requiredText(formData, "id", "Crop");
  const name = requiredText(formData, "name", "Crop name");
  const variety = normalizeVariety(optionalText(formData, "variety"));
  catalogSlug(name, variety);

  const wateringIntervalDays = optionalPositiveInteger(
    formData,
    "wateringIntervalDays",
    "Watering interval",
  );
  const fertilizingIntervalDays = optionalPositiveInteger(
    formData,
    "fertilizingIntervalDays",
    "Fertilizing interval",
  );
  const daysToHarvestMin = optionalPositiveInteger(
    formData,
    "daysToHarvestMin",
    "Days to harvest (min)",
  );
  const daysToHarvestMax = optionalPositiveInteger(
    formData,
    "daysToHarvestMax",
    "Days to harvest (max)",
  );

  if (
    daysToHarvestMin !== null &&
    daysToHarvestMax !== null &&
    daysToHarvestMax < daysToHarvestMin
  ) {
    throw new Error(
      "Days to harvest (max) must be greater than or equal to min.",
    );
  }

  return {
    id,
    name,
    variety,
    wateringIntervalDays,
    fertilizingIntervalDays,
    pruning: parsePruning(formData),
    frostSensitive: parseFrostSensitive(formData),
    sunPreference: parseSunPreference(formData),
    plantWindowStart: optionalMonthDay(
      formData,
      "plantWindowStart",
      "Plant window start",
    ),
    plantWindowEnd: optionalMonthDay(
      formData,
      "plantWindowEnd",
      "Plant window end",
    ),
    daysToHarvestMin,
    daysToHarvestMax,
    timeEstimates: parseTimeEstimates(formData),
    notes: optionalText(formData, "notes"),
  };
}

export function pruningFormValue(
  pruning: CropPruning | null,
): "none" | "needed" | "" {
  if (!pruning) {
    return "";
  }
  return pruning.needed ? "needed" : "none";
}

function positiveIntegerFromUnknown(
  value: unknown,
  label: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return value;
}

function minutesFromUnknown(value: unknown, label: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MINUTES_MIN ||
    value > MINUTES_MAX
  ) {
    throw new Error(
      `${label} must be between ${MINUTES_MIN} and ${MINUTES_MAX} minutes.`,
    );
  }
  return value;
}

function monthDayFromUnknown(value: unknown, label: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a month-day like 05-15.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(trimmed)) {
    throw new Error(`${label} must be a month-day like 05-15.`);
  }
  const month = Number(trimmed.slice(0, 2));
  const day = Number(trimmed.slice(3, 5));
  const parsed = new Date(Date.UTC(2024, month - 1, day));
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${label} must be a real calendar day.`);
  }
  return trimmed;
}

function pruningFromUnknown(value: unknown): CropPruning | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value === "none" || value === false) {
    return { needed: false };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Pruning must be none, needed, or left blank.");
  }
  const record = value as Record<string, unknown>;
  if (record.needed === false) {
    return { needed: false };
  }
  if (record.needed !== true) {
    throw new Error("Pruning must be none, needed, or left blank.");
  }
  const intervalDays =
    record.intervalDays === null || record.intervalDays === undefined
      ? null
      : positiveIntegerFromUnknown(record.intervalDays, "Pruning interval");
  const notes =
    record.notes === null || record.notes === undefined
      ? null
      : typeof record.notes === "string"
        ? record.notes.trim() || null
        : (() => {
            throw new Error("Pruning notes must be text.");
          })();
  return { needed: true, intervalDays, notes };
}

function timeEstimatesFromUnknown(value: unknown): CropTimeEstimates {
  if (value === null || value === undefined) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Time estimates must be an object of minutes per action.");
  }
  const record = value as Record<string, unknown>;
  const estimates: CropTimeEstimates = {};
  for (const action of TIME_ESTIMATE_ACTIONS) {
    if (!(action in record)) {
      continue;
    }
    const label =
      action === "observed"
        ? "Frost cover (observe) minutes"
        : action === "treated"
          ? "Frost cover (treat) minutes"
          : `${capitalize(action)} minutes`;
    const minutes = minutesFromUnknown(record[action], label);
    if (minutes !== null) {
      estimates[action as TimeEstimateAction] = minutes;
    }
  }
  return estimates;
}

/**
 * Validate a decoded Gemini crop-care payload with the same rules as catalog
 * edit. Extra keys are ignored. Never returns unparsed prose into care fields.
 */
export function validateCropCarePayload(raw: unknown): CropCareFields {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Crop draft must be a JSON object.");
  }

  const record = raw as Record<string, unknown>;

  let frostSensitive: boolean | null = null;
  if (record.frostSensitive !== null && record.frostSensitive !== undefined) {
    if (typeof record.frostSensitive !== "boolean") {
      throw new Error("Frost sensitive must be yes or no.");
    }
    frostSensitive = record.frostSensitive;
  }

  let sunPreference: SunExposure | null = null;
  if (record.sunPreference !== null && record.sunPreference !== undefined) {
    if (
      typeof record.sunPreference !== "string" ||
      !(SUN_EXPOSURES as readonly string[]).includes(record.sunPreference)
    ) {
      throw new Error("Sun preference is not a known value.");
    }
    sunPreference = record.sunPreference as SunExposure;
  }

  const daysToHarvestMin = positiveIntegerFromUnknown(
    record.daysToHarvestMin,
    "Days to harvest (min)",
  );
  const daysToHarvestMax = positiveIntegerFromUnknown(
    record.daysToHarvestMax,
    "Days to harvest (max)",
  );
  if (
    daysToHarvestMin !== null &&
    daysToHarvestMax !== null &&
    daysToHarvestMax < daysToHarvestMin
  ) {
    throw new Error(
      "Days to harvest (max) must be greater than or equal to min.",
    );
  }

  const notes =
    record.notes === null || record.notes === undefined
      ? null
      : typeof record.notes === "string"
        ? record.notes.trim() || null
        : (() => {
            throw new Error("Notes must be text.");
          })();

  return {
    wateringIntervalDays: positiveIntegerFromUnknown(
      record.wateringIntervalDays,
      "Watering interval",
    ),
    fertilizingIntervalDays: positiveIntegerFromUnknown(
      record.fertilizingIntervalDays,
      "Fertilizing interval",
    ),
    pruning: pruningFromUnknown(record.pruning),
    frostSensitive,
    sunPreference,
    plantWindowStart: monthDayFromUnknown(
      record.plantWindowStart,
      "Plant window start",
    ),
    plantWindowEnd: monthDayFromUnknown(
      record.plantWindowEnd,
      "Plant window end",
    ),
    daysToHarvestMin,
    daysToHarvestMax,
    timeEstimates: timeEstimatesFromUnknown(record.timeEstimates),
    notes,
  };
}
