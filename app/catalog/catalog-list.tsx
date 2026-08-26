"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { cropIdentityLabel, cropMatchesQuery } from "@/lib/crops/slug";
import type { CropListItem } from "@/lib/crops/types";

import { createStubCrop } from "./actions";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base outline-none focus:border-forest focus:ring-2 focus:ring-leaf";
const initialState = { status: "idle" as const };

function sourceLabel(source: CropListItem["source"]) {
  if (source === "stub") {
    return "Needs care numbers";
  }
  if (source === "edited") {
    return "Edited";
  }
  return "Drafted by Gemini";
}

export function CatalogList({ crops }: { crops: CropListItem[] }) {
  const [query, setQuery] = useState("");
  const [createState, createAction, createPending] = useActionState(
    createStubCrop,
    initialState,
  );
  const matches = useMemo(
    () =>
      crops.filter((crop) =>
        cropMatchesQuery(crop.name, crop.slug, query, crop.variety),
      ),
    [crops, query],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-forest">Add a crop</h2>
        <p className="mt-1 text-sm text-forest">
          Add a crop by name and optional variety. Later plantings of the same
          combination reuse this row. Tomato and Tomato / Sungold stay separate.
        </p>
        <form action={createAction} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-forest">
            Crop name
            <input
              className={fieldClass}
              name="name"
              required
              placeholder="Tomato"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm font-medium text-forest">
            Variety (optional)
            <input
              className={fieldClass}
              name="variety"
              placeholder="Sungold"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className={
                createState.status === "error"
                  ? "text-sm font-medium text-red-700"
                  : "text-sm font-medium text-forest"
              }
            >
              {createState.status === "idle"
                ? "We'll fill in a first draft of care numbers when we can."
                : createState.message}
            </p>
            <button
              type="submit"
              disabled={createPending}
              className="min-h-12 rounded-lg bg-forest px-6 font-semibold text-cream hover:bg-selection disabled:opacity-60"
            >
              {createPending ? "Creating…" : "Add crop"}
            </button>
          </div>
          {createState.status === "error" && createState.existingCropId ? (
            <p>
              <Link
                href={`/catalog/${createState.existingCropId}`}
                className="text-sm font-semibold text-forest underline"
              >
                Open the existing row
              </Link>
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-forest">Search crops</h2>
        <label className="mt-4 block text-sm font-medium text-forest">
          Search by name or variety
          <input
            className={fieldClass}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="tomato or sungold"
            autoComplete="off"
            aria-describedby="catalog-search-help"
          />
        </label>
        <p id="catalog-search-help" className="mt-2 text-sm text-forest">
          {crops.length === 0
            ? "No crops yet. Add one above, or record a planting."
            : `${matches.length} of ${crops.length} crop${crops.length === 1 ? "" : "s"}`}
        </p>

        {crops.length > 0 && matches.length === 0 ? (
          <p className="mt-4 text-sm text-forest">No crops match that search.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {matches.map((crop) => (
              <li key={crop.id}>
                <Link
                  href={`/catalog/${crop.id}`}
                  className="flex min-h-11 flex-col justify-center rounded-xl border px-4 py-3 hover:bg-cream sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="font-semibold text-forest">
                      {cropIdentityLabel(crop.name, crop.variety)}
                    </span>
                    <span className="mt-1 block text-sm text-forest sm:mt-0 sm:inline sm:before:content-['·'] sm:before:mx-2">
                      {sourceLabel(crop.source)}
                    </span>
                  </span>
                  <span className="text-sm text-forest">
                    {crop.wateringIntervalDays
                      ? `Water every ${crop.wateringIntervalDays} day${crop.wateringIntervalDays === 1 ? "" : "s"}`
                      : "Watering interval not set"}
                    {crop.plantingCount > 0
                      ? ` · ${crop.plantingCount} planting${crop.plantingCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
