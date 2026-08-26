import Link from "next/link";

import { requirePageUser } from "@/lib/auth/session";
import { listCurrentLocations } from "@/lib/garden/planting-repository";
import { GARDEN_SETUP_PATH } from "@/lib/garden/routes";

import { CurrentLocationsPanel } from "./current-locations-panel";

export default async function GardenPage() {
  await requirePageUser();
  const currentLocations = await listCurrentLocations();

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
            Garden
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Current locations
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Open a bed section or pot to see what is planted there. Profile, sun
            map, and season drawing live on Garden setup.
          </p>
        </div>
        <Link
          href={GARDEN_SETUP_PATH}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-green-800 px-4 text-sm font-semibold text-green-800 hover:bg-green-50"
        >
          Garden setup
        </Link>
      </header>

      <CurrentLocationsPanel locations={currentLocations} />
    </div>
  );
}
