"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { saveGardenProfile } from "./actions";
import type { GardenProfileRecord } from "@/lib/garden/profile-validation";
import {
  SUN_EXPOSURES,
  type SunExposure,
  type SunZoneInput,
} from "@/lib/garden/sun-exposure";

const EXPOSURE_DETAILS: Record<
  SunExposure,
  { label: string; description: string; color: string }
> = {
  full_sun: {
    label: "Full sun",
    description: "At least 6 hours of direct sun.",
    color: "bg-amber-300",
  },
  part_sun: {
    label: "Part sun",
    description: "About 4–6 hours of direct sun.",
    color: "bg-lime-300",
  },
  part_shade: {
    label: "Part shade",
    description: "About 2–4 hours of direct sun.",
    color: "bg-emerald-300",
  },
  full_shade: {
    label: "Shade",
    description: "Less than 2 hours of direct sun.",
    color: "bg-teal-500",
  },
};

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base outline-none focus:border-forest focus:ring-2 focus:ring-leaf";
const initialState = { status: "idle" as const };

function newZone(zones: SunZoneInput[], bedLengthFt: number): SunZoneInput[] {
  const last = zones.at(-1);
  if (!last) {
    return [{ startFt: 0, endFt: bedLengthFt, sunExposure: "full_sun" }];
  }

  const midpoint = Math.round(((last.startFt + last.endFt) / 2) * 10) / 10;
  if (midpoint <= last.startFt || midpoint >= last.endFt) {
    return [
      ...zones,
      {
        startFt: last.endFt,
        endFt: bedLengthFt,
        sunExposure: "full_sun",
      },
    ];
  }

  return [
    ...zones.slice(0, -1),
    { ...last, endFt: midpoint },
    { startFt: midpoint, endFt: last.endFt, sunExposure: last.sunExposure },
  ];
}

export function GardenProfileForm({
  profile,
}: {
  profile: GardenProfileRecord | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveGardenProfile,
    initialState,
  );
  const [bedLengthFt, setBedLengthFt] = useState(profile?.bedLengthFt ?? 50);
  const [zones, setZones] = useState<SunZoneInput[]>(
    profile?.sunZones.length
      ? profile.sunZones
      : [{ startFt: 0, endFt: profile?.bedLengthFt ?? 50, sunExposure: "full_sun" }],
  );

  function updateZone(index: number, change: Partial<SunZoneInput>) {
    setZones((current) =>
      current.map((zone, zoneIndex) =>
        zoneIndex === index ? { ...zone, ...change } : zone,
      ),
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-forest">Garden location</h2>
          <p className="mt-1 text-sm text-forest">
            Used to match weather and decide when each garden day begins.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-forest">
            Latitude
            <input
              className={fieldClass}
              name="latitude"
              type="number"
              inputMode="decimal"
              step="any"
              min="-90"
              max="90"
              required
              defaultValue={profile?.latitude}
              placeholder="45.5231"
            />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Longitude
            <input
              className={fieldClass}
              name="longitude"
              type="number"
              inputMode="decimal"
              step="any"
              min="-180"
              max="180"
              required
              defaultValue={profile?.longitude}
              placeholder="-122.6765"
            />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Timezone
            <input
              className={fieldClass}
              name="timezone"
              required
              defaultValue={profile?.timezone ?? "America/Los_Angeles"}
              placeholder="America/Los_Angeles"
            />
            <span className="mt-1 block font-normal text-forest">
              Use an IANA timezone name.
            </span>
          </label>
          <label className="block text-sm font-semibold text-forest">
            USDA hardiness zone
            <input
              className={fieldClass}
              name="hardinessZone"
              required
              defaultValue={profile?.hardinessZone}
              placeholder="8b"
            />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Average last frost (optional)
            <input
              className={fieldClass}
              name="averageLastFrostOn"
              type="date"
              defaultValue={profile?.averageLastFrostOn ?? ""}
            />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Average first frost (optional)
            <input
              className={fieldClass}
              name="averageFirstFrostOn"
              type="date"
              defaultValue={profile?.averageFirstFrostOn ?? ""}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-forest">Raised bed</h2>
          <p className="mt-1 text-sm text-forest">
            Record the permanent bed dimensions and its soil.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-forest">
            Length (feet)
            <input
              className={fieldClass}
              name="bedLengthFt"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              required
              value={bedLengthFt}
              onChange={(event) => setBedLengthFt(Number(event.target.value))}
            />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Width (feet)
            <input
              className={fieldClass}
              name="bedWidthFt"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              required
              defaultValue={profile?.bedWidthFt ?? 3}
            />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Soil type
            <input
              className={fieldClass}
              name="soilType"
              required
              defaultValue={profile?.soilType}
              placeholder="Loam"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-forest">Sun map</h2>
            <p className="mt-1 max-w-2xl text-sm text-forest">
              Zones must touch without overlapping and cover the entire 0–
              {bedLengthFt || 0} foot bed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setZones((current) => newZone(current, bedLengthFt))}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-forest hover:bg-cream"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add zone
          </button>
        </div>

        <div
          className="mt-6 flex h-14 overflow-hidden rounded-lg border bg-cream"
          aria-label="Sun exposure along the raised bed"
        >
          {zones.map((zone, index) => {
            const width =
              bedLengthFt > 0
                ? Math.max(0, ((zone.endFt - zone.startFt) / bedLengthFt) * 100)
                : 0;
            return (
              <div
                key={index}
                className={`${EXPOSURE_DETAILS[zone.sunExposure].color} flex min-w-0 items-center justify-center border-r border-white/70 px-1 text-center text-xs font-semibold text-forest last:border-r-0`}
                style={{ width: `${width}%` }}
                title={`${zone.startFt}–${zone.endFt} ft: ${EXPOSURE_DETAILS[zone.sunExposure].label}`}
              >
                {width >= 13 ? `${zone.startFt}–${zone.endFt} ft` : null}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-xs text-forest">
          <span>0 ft</span>
          <span>{bedLengthFt || 0} ft</span>
        </div>

        <div className="mt-6 space-y-4">
          {zones.map((zone, index) => (
            <fieldset
              key={index}
              className="rounded-xl border bg-white p-4"
            >
              <legend className="px-1 text-sm font-semibold">
                Zone {index + 1}
              </legend>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
                <label className="text-sm font-medium">
                  Starts at (ft)
                  <input
                    className={fieldClass}
                    name="zoneStartFt"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    required
                    value={zone.startFt}
                    onChange={(event) =>
                      updateZone(index, { startFt: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="text-sm font-medium">
                  Ends at (ft)
                  <input
                    className={fieldClass}
                    name="zoneEndFt"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    required
                    value={zone.endFt}
                    onChange={(event) =>
                      updateZone(index, { endFt: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="text-sm font-medium">
                  Exposure
                  <select
                    className={fieldClass}
                    name="zoneExposure"
                    value={zone.sunExposure}
                    onChange={(event) =>
                      updateZone(index, {
                        sunExposure: event.target.value as SunExposure,
                      })
                    }
                  >
                    {SUN_EXPOSURES.map((exposure) => (
                      <option key={exposure} value={exposure}>
                        {EXPOSURE_DETAILS[exposure].label} —{" "}
                        {EXPOSURE_DETAILS[exposure].description}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-forest">
                    {EXPOSURE_DETAILS[zone.sunExposure].description}
                  </span>
                </label>
                <button
                  type="button"
                  aria-label={`Remove zone ${index + 1}`}
                  onClick={() =>
                    setZones((current) =>
                      current.filter((_, zoneIndex) => zoneIndex !== index),
                    )
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  <span className="sm:hidden">Remove zone</span>
                </button>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="sticky bottom-20 rounded-xl border bg-white/95 p-4 backdrop-blur md:bottom-4">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            className={
              state.status === "error"
                ? "text-sm font-medium text-red-700"
                : "text-sm font-medium text-forest"
            }
          >
            {state.status === "idle" ? "Changes are not saved automatically." : state.message}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-lg bg-forest px-6 font-semibold text-cream hover:bg-selection disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save garden profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
