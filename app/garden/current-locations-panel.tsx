import Link from "next/link";

import type { CurrentLocationSummary } from "@/lib/garden/planting-repository";

export function CurrentLocationsPanel({
  locations,
}: {
  locations: CurrentLocationSummary[];
}) {
  const sections = locations.filter((location) => location.kind === "bed_section");
  const pots = locations.filter((location) => location.kind === "pot");

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Plantings by location</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Open a current pot or bed section to record what is growing there.
        </p>
      </div>

      {locations.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Draw this season&apos;s bed sections (and set up pots) before adding
          plantings.
        </p>
      ) : (
        <div className="space-y-6">
          {sections.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Bed sections
              </h3>
              <ul className="mt-3 space-y-2">
                {sections.map((location) => (
                  <li key={location.id}>
                    <Link
                      href={`/garden/${location.id}`}
                      className="flex min-h-11 flex-col justify-center rounded-xl border px-4 py-3 hover:border-green-700 hover:bg-green-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-semibold text-neutral-900">
                        {location.name}
                      </span>
                      <span className="text-sm text-neutral-600">
                        {location.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pots.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Pots
              </h3>
              <ul className="mt-3 space-y-2">
                {pots.map((location) => (
                  <li key={location.id}>
                    <Link
                      href={`/garden/${location.id}`}
                      className="flex min-h-11 flex-col justify-center rounded-xl border px-4 py-3 hover:border-green-700 hover:bg-green-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-semibold text-neutral-900">
                        {location.name}
                      </span>
                      <span className="text-sm text-neutral-600">
                        {location.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              No pots yet. Once pots are set up, they appear here for plantings.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
