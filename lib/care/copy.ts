import { cropCareCopyLabel } from "@/lib/crops/slug";
import { addCalendarDays, endOfLocalDay } from "@/lib/garden/local-date";
import { formatSunExposureLabel } from "@/lib/garden/sun-fit";

import type { CadenceNeed } from "./cadence";
import type { FrostNeed } from "./frost";
import type { MatchingTaskInput, RecommendationUrgency } from "./types";
import { formatInchesFromMm, type WateringNeed } from "./watering";

export const OPEN_METEO_ATTRIBUTION =
  "Weather data by Open-Meteo (CC BY 4.0).";

export const MICROCLIMATE_LIMITATION =
  "Without sensors, GreenThumb cannot see this yard's microclimate.";

const URGENCY_HEADLINE: Record<WateringNeed["urgency"], string> = {
  now: "water now",
  today: "water today",
  this_week: "water this week",
  monitor: "skip watering",
};

export function wateringTask(
  need: WateringNeed,
  today: string,
  timeZone: string,
): MatchingTaskInput {
  const upcoming = formatInchesFromMm(need.upcomingRainMm);
  const week = formatInchesFromMm(need.weekRainMm);
  const lastWatered = lastWateredPhrase(need);
  const cadence = `${cropCareCopyLabel(need.planting.cropName, need.planting.variety)} want water every ${need.planting.wateringIntervalDays} days`;
  const headline = `${need.planting.locationName} — ${URGENCY_HEADLINE[need.urgency]}`;
  const rationale =
    need.urgency === "monitor" || need.urgency === "this_week"
      ? `${upcoming} rain coming today–tomorrow, ${lastWatered}, ${cadence}`
      : `${lastWatered}, ${week} rain this week, ${cadence}`;

  return {
    locationId: need.planting.locationId,
    plantingId: need.planting.plantingId,
    cropId: need.planting.cropId,
    actionType: "watered",
    urgency: need.urgency,
    headline,
    rationale,
    evidence: {
      facts: [
        {
          source:
            need.lastWateredSource === "action_log" ? "care log" : "planting",
          figure:
            need.lastWateredSource === "action_log"
              ? `last watered ${need.lastWateredOn}`
              : `planted ${need.lastWateredOn} (no watered log)`,
        },
        {
          source: "crop catalog",
          figure: `water every ${need.planting.wateringIntervalDays} days`,
        },
        {
          source: "weather cache",
          figure: `${upcoming} rain coming today–tomorrow`,
        },
        {
          source: "weather cache",
          figure: `${week} rain this week`,
        },
        {
          source: "weather cache",
          figure: `${need.et0Mm.toFixed(1)} mm ET₀ since last water`,
        },
        {
          source: "location",
          figure: `dryness_factor ${formatDryness(need.planting.drynessFactor)}`,
        },
      ],
    },
    estimatedMinutes: need.planting.estimatedMinutes,
    dueBy: dueByFor(need.urgency, today, timeZone),
  };
}

const CADENCE_HEADLINE: Record<
  CadenceNeed["actionType"],
  Record<"now" | "today", string>
> = {
  fertilized: { now: "fertilize now", today: "fertilize today" },
  pruned: { now: "prune now", today: "prune today" },
};

const CADENCE_NOUN: Record<CadenceNeed["actionType"], string> = {
  fertilized: "fertilizer",
  pruned: "pruning",
};

const CADENCE_PAST: Record<CadenceNeed["actionType"], string> = {
  fertilized: "fertilized",
  pruned: "pruned",
};

export function cadenceTask(
  need: CadenceNeed,
  today: string,
  timeZone: string,
): MatchingTaskInput {
  const verb = CADENCE_HEADLINE[need.actionType][need.urgency === "now" ? "now" : "today"];
  const noun = CADENCE_NOUN[need.actionType];
  const past = CADENCE_PAST[need.actionType];
  const last = lastCadencePhrase(need, past);
  const cadence = `${cropCareCopyLabel(need.planting.cropName, need.planting.variety)} want ${noun} every ${need.intervalDays} days`;
  const pruneNotes =
    need.actionType === "pruned" && need.planting.pruning?.needed
      ? need.planting.pruning.notes
      : null;

  return {
    locationId: need.planting.locationId,
    plantingId: need.planting.plantingId,
    cropId: need.planting.cropId,
    actionType: need.actionType,
    urgency: need.urgency,
    headline: `${need.planting.locationName} — ${verb}`,
    rationale: pruneNotes
      ? `${last}, ${cadence} (${pruneNotes})`
      : `${last}, ${cadence}`,
    evidence: {
      facts: [
        {
          source: need.lastSource === "action_log" ? "care log" : "planting",
          figure:
            need.lastSource === "action_log"
              ? `last ${past} ${need.lastOn}`
              : `planted ${need.lastOn} (no ${past} log)`,
        },
        {
          source: "crop catalog",
          figure: `${noun} every ${need.intervalDays} days`,
        },
        ...(pruneNotes
          ? [{ source: "crop catalog", figure: pruneNotes }]
          : []),
      ],
    },
    estimatedMinutes:
      need.actionType === "fertilized"
        ? need.planting.fertilizeMinutes
        : need.planting.pruneMinutes,
    dueBy: dueByFor(need.urgency, today, timeZone),
  };
}

export function frostTask(
  need: FrostNeed,
  today: string,
  timeZone: string,
): MatchingTaskInput {
  const low = formatCelsius(need.tonightMinC);
  const headlineVerb = need.urgency === "now" ? "cover tonight" : "cover today";
  return {
    locationId: need.planting.locationId,
    plantingId: need.planting.plantingId,
    cropId: need.planting.cropId,
    actionType: "treated",
    urgency: need.urgency,
    headline: `${need.planting.locationName} — ${headlineVerb}`,
    rationale: `${cropCareCopyLabel(need.planting.cropName, need.planting.variety)} are frost-sensitive, forecast low ${low}`,
    evidence: {
      facts: [
        {
          source: "crop catalog",
          figure: "frost_sensitive true",
        },
        {
          source: "weather cache",
          figure: `forecast min ${low}`,
        },
        {
          source: "matching rule",
          figure: `frost threshold ${formatCelsius(need.thresholdC)}`,
        },
      ],
    },
    estimatedMinutes: need.planting.frostMinutes,
    dueBy: dueByFor(need.urgency, today, timeZone),
  };
}

export function formatCelsius(celsius: number): string {
  const rounded = Math.round(celsius * 10) / 10;
  return `${rounded.toFixed(1)}°C`;
}

function lastWateredPhrase(need: WateringNeed): string {
  if (need.lastWateredSource === "planted_on") {
    return need.daysSince === 0
      ? "planted today, not yet watered"
      : `planted ${dayPhrase(need.daysSince)}, not yet watered`;
  }
  return need.daysSince === 0
    ? "last watered today"
    : `last watered ${dayPhrase(need.daysSince)}`;
}

function lastCadencePhrase(need: CadenceNeed, past: string): string {
  if (need.lastSource === "planted_on") {
    return need.daysSince === 0
      ? `planted today, not yet ${past}`
      : `planted ${dayPhrase(need.daysSince)}, not yet ${past}`;
  }
  return need.daysSince === 0
    ? `last ${past} today`
    : `last ${past} ${dayPhrase(need.daysSince)}`;
}

function dueByFor(
  urgency: RecommendationUrgency,
  today: string,
  timeZone: string,
): Date {
  if (urgency === "this_week") {
    return endOfLocalDay(addCalendarDays(today, 6), timeZone);
  }
  if (urgency === "monitor") {
    return endOfLocalDay(addCalendarDays(today, 1), timeZone);
  }
  return endOfLocalDay(today, timeZone);
}

function dayPhrase(days: number): string {
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function sunMismatchTask(
  planting: {
    locationId: string;
    locationName: string;
    plantingId: string;
    cropId: string;
    cropName: string;
    variety: string | null;
    sunPreference: "full_sun" | "part_sun" | "part_shade" | "full_shade";
    locationSunExposure: string;
  },
  today: string,
  timeZone: string,
): MatchingTaskInput {
  const cropLabel = cropCareCopyLabel(planting.cropName, planting.variety);
  const preference = formatSunExposureLabel(planting.sunPreference);
  const location = formatSunExposureLabel(planting.locationSunExposure);

  return {
    locationId: planting.locationId,
    plantingId: planting.plantingId,
    cropId: planting.cropId,
    actionType: "observed",
    urgency: "monitor",
    headline: `${planting.locationName} — sun does not match`,
    rationale: `${cropLabel} want ${preference}; this location is ${location}`,
    evidence: {
      facts: [
        {
          source: "crop catalog",
          figure: `sun_preference ${planting.sunPreference}`,
        },
        {
          source: "location",
          figure: `sun_exposure ${planting.locationSunExposure}`,
        },
      ],
    },
    estimatedMinutes: null,
    dueBy: dueByFor("monitor", today, timeZone),
  };
}

function formatDryness(value: number): string {
  return String(Math.round(value * 100) / 100);
}
