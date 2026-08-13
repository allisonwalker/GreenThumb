"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { cropMatchesQuery } from "@/lib/crops/slug";
import type { CropListItem } from "@/lib/crops/types";

import { createStubCrop } from "./actions";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200";
const initialState = { status: "idle" as const };

function sourceLabel(source: CropListItem["source"]) {
  if (source === "stub") {
    return "Stub — fill in care details";
  }
  if (source === "edited") {
    return "Edited";
  }
  return "Generated";
}

export function CatalogList({ crops }: { crops: CropListItem[] }) {
  const [query, setQuery] = useState("");
  const [createState, createAction, createPending] = useActionState(
    createStubCrop,
    initialState,
  );
  const matches = useMemo(
    () =>
      crops.filter((crop) => cropMatchesQuery(crop.name, crop.slug, query)),
    [crops, query],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold">Add a stub crop</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Use this when you want a care row before a planting exists. A later
          planting with the same name reuses this row.
        </p>
        <form action={createAction} className="mt-4 space-y-3">
          <label className="block text-sm font-medium">
            Crop name
            <input
              className={fieldClass}
              name="name"
              required
              placeholder="Tomato"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className={
                createState.status === "error"
                  ? "text-sm font-medium text-red-700"
                  : "text-sm font-medium text-green-800"
              }
            >
              {createState.status === "idle"
                ? "No model call — this is a blank row you can edit."
                : createState.message}
            </p>
            <button
              type="submit"
              disabled={createPending}
              className="min-h-12 rounded-lg bg-green-800 px-6 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
            >
              {createPending ? "Creating…" : "Create stub"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold">Search crops</h2>
        <label className="mt-4 block text-sm font-medium">
          Search by name
          <input
            className={fieldClass}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="tomato"
            autoComplete="off"
            aria-describedby="catalog-search-help"
          />
        </label>
        <p id="catalog-search-help" className="mt-2 text-sm text-neutral-600">
          {crops.length === 0
            ? "No crop rows yet. Add a stub above, or record a planting."
            : `${matches.length} of ${crops.length} crop${crops.length === 1 ? "" : "s"}`}
        </p>

        {crops.length > 0 && matches.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No crops match that search.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {matches.map((crop) => (
              <li key={crop.id}>
                <Link
                  href={`/catalog/${crop.id}`}
                  className="flex min-h-11 flex-col justify-center rounded-xl border px-4 py-3 hover:border-green-700 hover:bg-green-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="font-semibold text-neutral-900">
                      {crop.name}
                    </span>
                    <span className="mt-1 block text-sm text-neutral-600 sm:mt-0 sm:inline sm:before:content-['·'] sm:before:mx-2">
                      {sourceLabel(crop.source)}
                    </span>
                  </span>
                  <span className="text-sm text-neutral-600">
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
