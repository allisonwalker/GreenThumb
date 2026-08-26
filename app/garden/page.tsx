import Link from "next/link";
import { redirect } from "next/navigation";

import { requirePageUser } from "@/lib/auth/session";
import { listCurrentLocations } from "@/lib/garden/planting-repository";
import {
  emptyGardenDashboardRedirect,
  GARDEN_SETUP_PATH,
} from "@/lib/garden/routes";

import { CurrentLocationsPanel } from "./current-locations-panel";

export default async function GardenPage() {
  await requirePageUser();
  const currentLocations = await listCurrentLocations();
  const setupPath = emptyGardenDashboardRedirect(currentLocations.length);
  if (setupPath) {
    redirect(setupPath);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-5xl font-bold leading-none tracking-display text-forest sm:text-6xl">
            Current locations
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-forest">
            Open a bed section or pot to see what is planted there. Profile, sun
            map, and season drawing live on Garden setup.
          </p>
        </div>
        <Link
          href={GARDEN_SETUP_PATH}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border bg-white px-4 text-sm font-semibold text-forest hover:bg-cream"
        >
          Garden setup
        </Link>
      </header>

      <CurrentLocationsPanel locations={currentLocations} />
    </div>
  );
}
