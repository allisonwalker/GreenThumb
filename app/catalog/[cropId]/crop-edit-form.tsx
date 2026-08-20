"use client";

import Link from "next/link";
import { useActionState } from "react";

import { cropAttributionFromRecord } from "@/lib/crops/attribution";
import { cropIdentityLabel } from "@/lib/crops/slug";
import { TIME_ESTIMATE_ACTIONS, type CropRecord } from "@/lib/crops/types";
import { pruningFormValue } from "@/lib/crops/validation";
import { SUN_EXPOSURES } from "@/lib/garden/sun-exposure";

import { draftCropWithGemini, saveCrop } from "../actions";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200";
const initialState = { status: "idle" as const };

const TIME_ESTIMATE_LABELS: Record<(typeof TIME_ESTIMATE_ACTIONS)[number], string> = {
  watered: "Watered",
  fertilized: "Fertilized",
  pruned: "Pruned",
  harvested: "Harvested",
  planted: "Planted",
  observed: "Frost cover (observe)",
  treated: "Frost cover (treat)",
};

export function CropEditForm({ crop }: { crop: CropRecord }) {
  const [state, formAction, pending] = useActionState(saveCrop, initialState);
  const [draftState, draftAction, draftPending] = useActionState(
    draftCropWithGemini,
    initialState,
  );
  const pruning = pruningFormValue(crop.pruning);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          <Link href="/catalog" className="hover:underline">
            Catalog
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {cropIdentityLabel(crop.name, crop.variety)}
        </h1>
        <p className="mt-2 text-neutral-600">
          Slug <span className="font-mono text-sm">{crop.slug}</span> is
          computed from name and variety. Saving a colliding identity fails and
          does not persist. Saving this form marks the row as edited without
          clearing Gemini attribution.
        </p>
        <p className="mt-2 text-sm font-medium text-green-800">
          {cropAttributionFromRecord(crop)}
        </p>
        {crop.source === "stub" ? (
          <form action={draftAction} className="mt-4">
            <input type="hidden" name="id" value={crop.id} />
            <button
              type="submit"
              disabled={draftPending}
              className="min-h-11 rounded-lg border border-green-800 px-4 text-sm font-semibold text-green-900 hover:bg-green-50 disabled:opacity-60"
            >
              {draftPending ? "Drafting…" : "Draft with Gemini"}
            </button>
            <p
              aria-live="polite"
              className={
                draftState.status === "error"
                  ? "mt-2 text-sm font-medium text-red-700"
                  : "mt-2 text-sm font-medium text-green-800"
              }
            >
              {draftState.status === "idle"
                ? "One structured Gemini call — not a chat tool."
                : draftState.message}
            </p>
          </form>
        ) : null}
      </header>

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={crop.id} />

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Name and variety</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Display name
              <input
                className={fieldClass}
                name="name"
                required
                defaultValue={crop.name}
                autoComplete="off"
              />
            </label>
            <label className="text-sm font-medium">
              Variety (optional)
              <input
                className={fieldClass}
                name="variety"
                defaultValue={crop.variety ?? ""}
                placeholder="Sungold"
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Cadence</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Leave a field blank if you don&apos;t know it. Matching will skip
            that task instead of guessing.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Watering interval (days)
              <input
                className={fieldClass}
                name="wateringIntervalDays"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={crop.wateringIntervalDays ?? ""}
              />
            </label>
            <label className="text-sm font-medium">
              Fertilizing interval (days)
              <input
                className={fieldClass}
                name="fertilizingIntervalDays"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={crop.fertilizingIntervalDays ?? ""}
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Pruning
              <select
                className={fieldClass}
                name="pruning"
                defaultValue={pruning}
              >
                <option value="">Not set</option>
                <option value="none">None — this crop is not pruned</option>
                <option value="needed">Needed</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Pruning interval (days)
              <input
                className={fieldClass}
                name="pruningIntervalDays"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={
                  crop.pruning?.needed ? (crop.pruning.intervalDays ?? "") : ""
                }
              />
            </label>
            <label className="text-sm font-medium">
              Pruning notes
              <input
                className={fieldClass}
                name="pruningNotes"
                defaultValue={crop.pruning?.needed ? (crop.pruning.notes ?? "") : ""}
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Conditions</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Frost sensitive
              <select
                className={fieldClass}
                name="frostSensitive"
                defaultValue={
                  crop.frostSensitive === null
                    ? ""
                    : crop.frostSensitive
                      ? "true"
                      : "false"
                }
              >
                <option value="">Not set</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Sun preference
              <select
                className={fieldClass}
                name="sunPreference"
                defaultValue={crop.sunPreference ?? ""}
              >
                <option value="">Not set</option>
                {SUN_EXPOSURES.map((exposure) => (
                  <option key={exposure} value={exposure}>
                    {exposure.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Plant window start (MM-DD)
              <input
                className={fieldClass}
                name="plantWindowStart"
                placeholder="05-01"
                defaultValue={crop.plantWindowStart ?? ""}
                autoComplete="off"
              />
            </label>
            <label className="text-sm font-medium">
              Plant window end (MM-DD)
              <input
                className={fieldClass}
                name="plantWindowEnd"
                placeholder="06-15"
                defaultValue={crop.plantWindowEnd ?? ""}
                autoComplete="off"
              />
            </label>
            <label className="text-sm font-medium">
              Days to harvest (min)
              <input
                className={fieldClass}
                name="daysToHarvestMin"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={crop.daysToHarvestMin ?? ""}
              />
            </label>
            <label className="text-sm font-medium">
              Days to harvest (max)
              <input
                className={fieldClass}
                name="daysToHarvestMax"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={crop.daysToHarvestMax ?? ""}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Minutes per task</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Whole minutes, 1–480. Used later when planning a time budget.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {TIME_ESTIMATE_ACTIONS.map((action) => (
              <label key={action} className="text-sm font-medium">
                {TIME_ESTIMATE_LABELS[action]}
                <input
                  className={fieldClass}
                  name={`minutes_${action}`}
                  type="number"
                  min={1}
                  max={480}
                  step={1}
                  inputMode="numeric"
                  defaultValue={crop.timeEstimates?.[action] ?? ""}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Notes</h2>
          <label className="mt-4 block text-sm font-medium">
            Household notes for this crop
            <textarea
              className={`${fieldClass} min-h-24 py-2`}
              name="notes"
              defaultValue={crop.notes ?? ""}
            />
          </label>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p
              aria-live="polite"
              className={
                state.status === "error"
                  ? "text-sm font-medium text-red-700"
                  : "text-sm font-medium text-green-800"
              }
            >
              {state.status === "idle"
                ? "Saving does not call a model."
                : state.message}
            </p>
            {state.status === "error" && state.existingCropId ? (
              <p>
                <Link
                  href={`/catalog/${state.existingCropId}`}
                  className="text-sm font-semibold text-green-800 underline"
                >
                  Open the existing row
                </Link>
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-lg bg-green-800 px-6 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save crop"}
          </button>
        </div>
      </form>
    </div>
  );
}
