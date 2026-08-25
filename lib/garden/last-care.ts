import { localDateString } from "./local-date";

export type CareLogInstant = {
  locationId: string;
  actionType: string;
  occurredAt: Date;
  voided: boolean;
};

export type LastCareDates = {
  lastWateredOn: string | null;
  lastFertilizedOn: string | null;
};

/**
 * Last watered / fertilized is the garden-local calendar date of the latest
 * active (not voided) matching entry. Voiding is append-only: the original
 * row stays; a later correcting row points at it and drops it from this
 * derivation.
 */
export function lastActionLocalDate(
  entries: CareLogInstant[],
  locationId: string,
  actionType: string,
  timeZone: string,
): string | null {
  const matching = entries.filter(
    (entry) =>
      !entry.voided &&
      entry.locationId === locationId &&
      entry.actionType === actionType,
  );
  if (matching.length === 0) {
    return null;
  }

  const latest = matching.reduce((winner, entry) =>
    entry.occurredAt > winner.occurredAt ? entry : winner,
  );
  return localDateString(latest.occurredAt, timeZone);
}

export function lastCareByLocation(
  entries: CareLogInstant[],
  locationIds: string[],
  timeZone: string,
): Record<string, LastCareDates> {
  return Object.fromEntries(
    locationIds.map((locationId) => [
      locationId,
      {
        lastWateredOn: lastActionLocalDate(
          entries,
          locationId,
          "watered",
          timeZone,
        ),
        lastFertilizedOn: lastActionLocalDate(
          entries,
          locationId,
          "fertilized",
          timeZone,
        ),
      },
    ]),
  );
}
