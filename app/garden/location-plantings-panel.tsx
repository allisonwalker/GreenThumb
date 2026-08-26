"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { LocationPlantingsPage } from "@/lib/garden/planting-repository";
import { PLANTING_METHODS } from "@/lib/garden/planting-validation";

import { addPlanting, removePlanting } from "./actions";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base outline-none focus:border-forest focus:ring-2 focus:ring-leaf";
const initialState = { status: "idle" as const };

function StatusLine({
  state,
  idle,
}: {
  state: { status: string; message?: string };
  idle: string;
}) {
  return (
    <p
      aria-live="polite"
      className={
        state.status === "error"
          ? "text-sm font-medium text-red-700"
          : "text-sm font-medium text-forest"
      }
    >
      {state.status === "idle" ? idle : state.message}
    </p>
  );
}

function PlantingHeading({
  cropId,
  cropName,
  variety,
}: {
  cropId: string;
  cropName: string;
  variety: string | null;
}) {
  return (
    <h3 className="font-semibold text-forest">
      <Link href={`/catalog/${cropId}`} className="underline">
        {cropName}
      </Link>
      {variety ? (
        <span className="font-normal text-forest"> · {variety}</span>
      ) : null}
    </h3>
  );
}

export function LocationPlantingsPanel({
  page,
}: {
  page: LocationPlantingsPage;
}) {
  const [addState, addAction, addPending] = useActionState(
    addPlanting,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removePlanting,
    initialState,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <p className="text-sm font-medium text-forest">
          <Link href="/garden" className="underline">
            Garden
          </Link>
          {" · "}
          {page.location.kind === "pot" ? "Pot" : "Bed section"}
        </p>
        <h1 className="mt-3 text-5xl font-bold leading-none tracking-display text-forest sm:text-6xl">
          {page.location.name}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-forest">
          {page.location.detail}
        </p>
        {!page.location.isCurrent ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-forest">
            This location is not in the current season. You can review history,
            but new plantings go on current pots and sections.
          </p>
        ) : null}
      </header>

      {page.location.isCurrent ? (
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-forest">Add a planting</h2>
          <p className="mt-1 text-sm text-forest">
            Crop name attaches this planting to a shared care row. Variety stays
            here. Matching will skip a task if that crop field is still blank.
          </p>
          <form action={addAction} className="mt-5 space-y-4">
            <input type="hidden" name="locationId" value={page.location.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">
                Crop name
                <input
                  className={fieldClass}
                  name="cropName"
                  required
                  placeholder="sungold tomato"
                  autoComplete="off"
                />
              </label>
              <label className="text-sm font-medium">
                Variety (optional)
                <input
                  className={fieldClass}
                  name="variety"
                  placeholder="Sungold"
                  autoComplete="off"
                />
              </label>
              <label className="text-sm font-medium">
                Method
                <select
                  className={fieldClass}
                  name="method"
                  required
                  defaultValue="transplant"
                >
                  {PLANTING_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Planted date
                <input
                  className={fieldClass}
                  name="plantedOn"
                  type="date"
                  required
                  defaultValue={page.todayLocal}
                />
              </label>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StatusLine state={addState} idle="Visible to both household users." />
              <button
                type="submit"
                disabled={addPending}
                className="min-h-12 rounded-lg bg-forest px-6 font-semibold text-cream hover:bg-selection disabled:opacity-60"
              >
                {addPending ? "Saving…" : "Add planting"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-forest">Current plantings</h2>
        <p className="mt-1 text-sm text-forest">
          Days since planting use the garden timezone ({page.timezone}).
        </p>
        {page.currentPlantings.length === 0 ? (
          <p className="mt-4 text-sm text-forest">
            Nothing growing here right now.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {page.currentPlantings.map((planting) => (
              <li
                key={planting.id}
                className="rounded-xl border bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <PlantingHeading
                    cropId={planting.cropId}
                    cropName={planting.cropName}
                    variety={planting.variety}
                  />
                  <p className="text-sm font-medium text-forest">
                    {planting.daysSincePlanted} day
                    {planting.daysSincePlanted === 1 ? "" : "s"} since planting
                  </p>
                </div>
                <p className="mt-1 text-sm text-forest">
                  {planting.method} · planted {planting.plantedOn}
                </p>
                <form
                  action={removeAction}
                  className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-[1fr_auto] sm:items-end"
                >
                  <input type="hidden" name="plantingId" value={planting.id} />
                  <input
                    type="hidden"
                    name="locationId"
                    value={page.location.id}
                  />
                  <label className="text-sm font-medium">
                    Mark removed on
                    <input
                      className={fieldClass}
                      name="removedOn"
                      type="date"
                      required
                      defaultValue={page.todayLocal}
                      min={planting.plantedOn}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={removePending}
                    className="min-h-11 rounded-lg border border-red-700 px-4 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                  >
                    {removePending ? "Updating…" : "Mark removed"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <StatusLine state={removeState} idle="" />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-forest">Past plantings</h2>
        <p className="mt-1 text-sm text-forest">
          Removed plantings stay here for history.
        </p>
        {page.pastPlantings.length === 0 ? (
          <p className="mt-4 text-sm text-forest">No past plantings yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {page.pastPlantings.map((planting) => (
              <li
                key={planting.id}
                className="rounded-xl border bg-white px-4 py-3"
              >
                <PlantingHeading
                  cropId={planting.cropId}
                  cropName={planting.cropName}
                  variety={planting.variety}
                />
                <p className="mt-1 text-sm text-forest">
                  {planting.method} · planted {planting.plantedOn}
                  {planting.removedOn
                    ? ` · removed ${planting.removedOn}`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
