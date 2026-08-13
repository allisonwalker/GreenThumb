import type { SunExposure } from "@/lib/garden/sun-exposure";

export const CROP_SOURCES = ["generated", "edited", "stub"] as const;

export type CropSource = (typeof CROP_SOURCES)[number];

export const TIME_ESTIMATE_ACTIONS = [
  "watered",
  "fertilized",
  "pruned",
  "harvested",
  "planted",
  "observed",
  "treated",
] as const;

export type TimeEstimateAction = (typeof TIME_ESTIMATE_ACTIONS)[number];

export type CropTimeEstimates = Partial<Record<TimeEstimateAction, number>>;

export type CropPruning =
  | { needed: false }
  | { needed: true; intervalDays: number | null; notes: string | null };

export type CropRecord = {
  id: string;
  name: string;
  slug: string;
  wateringIntervalDays: number | null;
  fertilizingIntervalDays: number | null;
  pruning: CropPruning | null;
  frostSensitive: boolean | null;
  sunPreference: SunExposure | null;
  plantWindowStart: string | null;
  plantWindowEnd: string | null;
  daysToHarvestMin: number | null;
  daysToHarvestMax: number | null;
  timeEstimates: CropTimeEstimates | null;
  source: CropSource;
  generatedByProvider: string | null;
  generatedByModel: string | null;
  notes: string | null;
};

export type CropListItem = {
  id: string;
  name: string;
  slug: string;
  source: CropSource;
  wateringIntervalDays: number | null;
  plantingCount: number;
};

export const MINUTES_MIN = 1;
export const MINUTES_MAX = 480;
