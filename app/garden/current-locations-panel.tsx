import Link from "next/link";

import { groupLocationsForGardenDashboard } from "@/lib/garden/location-summary";
import type { CurrentLocationSummary } from "@/lib/garden/planting-repository";
import { gardenLocationPath } from "@/lib/garden/routes";

function LocationRow({ location }: { location: CurrentLocationSummary }) {
  return (
    <li>
      <Link
        href={gardenLocationPath(location.id)}
        className="flex min-h-11 flex-col justify-center rounded-xl border px-4 py-3 hover:bg-cream sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="font-semibold text-forest">{location.name}</span>
        <span className="text-sm text-forest">
          {location.plantingSummary}
        </span>
      </Link>
    </li>
  );
}

export function CurrentLocationsPanel({
  locations,
}: {
  locations: CurrentLocationSummary[];
}) {
  const { sections, pots } = groupLocationsForGardenDashboard(locations);

  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-forest">Locations</h2>
        <p className="mt-1 text-sm text-forest">
          Bed sections first, then pots. Open a row to see what is growing
          there.
        </p>
      </div>

      {locations.length === 0 ? (
        <p className="text-sm text-forest">
          Draw this season&apos;s bed sections (and set up pots) before adding
          plantings.
        </p>
      ) : (
        <div className="space-y-6">
          {sections.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-forest">
                Bed sections
              </h3>
              <ul className="mt-3 space-y-2">
                {sections.map((location) => (
                  <LocationRow key={location.id} location={location} />
                ))}
              </ul>
            </div>
          ) : null}

          {pots.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-forest">Pots</h3>
              <ul className="mt-3 space-y-2">
                {pots.map((location) => (
                  <LocationRow key={location.id} location={location} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-forest">
              No pots yet. Once pots are set up, they appear here for plantings.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
