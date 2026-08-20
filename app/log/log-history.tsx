"use client";

import { useState } from "react";

import type { ActionLogHistoryEntry } from "@/lib/garden/action-log-repository";
import {
  ACTION_TYPE_LABELS,
  isActionType,
} from "@/lib/garden/action-types";
import { localDateTimeString } from "@/lib/garden/local-date";

import { VoidLogEntryForm } from "./void-log-entry-form";

function actionLabel(actionType: string) {
  return isActionType(actionType)
    ? ACTION_TYPE_LABELS[actionType]
    : actionType;
}

function occurredAtDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function LogHistory({
  entries,
  locations,
  timeZone,
  lastCare,
}: {
  entries: ActionLogHistoryEntry[];
  locations: { id: string; name: string }[];
  timeZone: string;
  lastCare: Record<
    string,
    { lastWateredOn: string | null; lastFertilizedOn: string | null }
  >;
}) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const selected = locations.find(
    (location) => location.id === selectedLocationId,
  );
  const visibleEntries = selectedLocationId
    ? entries.filter((entry) => entry.locationId === selectedLocationId)
    : entries;
  const careSummary = selectedLocationId
    ? lastCare[selectedLocationId]
    : null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">History</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Newest first. Corrections add a new row; they never delete the
            original.
          </p>
        </div>
        <label className="text-sm font-semibold">
          Filter
          <select
            className="mt-2 block min-h-11 min-w-48 rounded-lg border bg-white px-3 text-base font-normal shadow-sm"
            name="locationFilter"
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
          >
            <option value="">Whole garden</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {careSummary ? (
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-950">
          {selected?.name ?? "This location"}: last watered{" "}
          {careSummary.lastWateredOn ?? "not yet"}, last fertilized{" "}
          {careSummary.lastFertilizedOn ?? "not yet"} (garden-local dates).
        </p>
      ) : locations.length > 0 ? (
        <ul className="mb-4 grid gap-2 sm:grid-cols-2">
          {locations.map((location) => {
            const care = lastCare[location.id];
            return (
              <li
                key={location.id}
                className="rounded-xl border bg-white px-4 py-3 text-sm"
              >
                <button
                  type="button"
                  onClick={() => setSelectedLocationId(location.id)}
                  className="font-semibold text-green-900 underline-offset-2 hover:underline"
                >
                  {location.name}
                </button>
                <p className="mt-1 text-neutral-600">
                  Last watered {care?.lastWateredOn ?? "not yet"} · fertilized{" "}
                  {care?.lastFertilizedOn ?? "not yet"}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {visibleEntries.length === 0 ? (
        <p className="rounded-2xl border bg-white p-5 text-sm text-neutral-600 shadow-sm">
          No entries yet{selected ? ` for ${selected.name}` : ""}.
        </p>
      ) : (
        <ol className="space-y-3">
          {visibleEntries.map((entry) => {
            const occurredAt = occurredAtDate(entry.occurredAt);
            return (
              <li
                key={entry.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  entry.voided ? "opacity-70" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {actionLabel(entry.actionType)}
                    {entry.voided ? (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-red-800">
                        Voided
                      </span>
                    ) : null}
                    {entry.voidsId ? (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                        Correction
                      </span>
                    ) : null}
                  </p>
                  <time
                    className="text-sm text-neutral-600"
                    dateTime={occurredAt.toISOString()}
                  >
                    {localDateTimeString(occurredAt, timeZone).replace(
                      "T",
                      " ",
                    )}
                  </time>
                </div>
                <p className="mt-1 text-sm text-neutral-700">
                  {entry.locationName} · {entry.loggedByEmail}
                </p>
                {entry.detail ? (
                  <p className="mt-2 text-sm text-neutral-800">{entry.detail}</p>
                ) : null}
                {!entry.voided && !entry.voidsId ? (
                  <VoidLogEntryForm entryId={entry.id} />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
