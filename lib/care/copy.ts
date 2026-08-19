import { addCalendarDays, endOfLocalDay } from "@/lib/garden/local-date";

import type { MatchingTaskInput } from "./types";
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
  const cadence = `${need.planting.cropName} want water every ${need.planting.wateringIntervalDays} days`;
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

function dueByFor(
  urgency: WateringNeed["urgency"],
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

function formatDryness(value: number): string {
  return String(Math.round(value * 100) / 100);
}
