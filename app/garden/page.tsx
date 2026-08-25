import { requirePageUser } from "@/lib/auth/session";
import { listCurrentLocations } from "@/lib/garden/planting-repository";
import { getGardenProfileRecord } from "@/lib/garden/profile-repository";
import { getSeasonBoardRecord } from "@/lib/garden/season-repository";

import { CurrentLocationsPanel } from "./current-locations-panel";
import { GardenProfileForm } from "./garden-profile-form";
import {
  PreviousSeasonsPanel,
  SeasonSectionsPanel,
} from "./season-sections-panel";

export default async function GardenPage() {
  await requirePageUser();
  const [profile, seasonBoard, currentLocations] = await Promise.all([
    getGardenProfileRecord(),
    getSeasonBoardRecord(),
    listCurrentLocations(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Garden setup
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Your garden profile
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Set the location and permanent sun map, draw this season&apos;s bed
          sections, then record what is planted in each section and pot.
        </p>
      </header>

      <GardenProfileForm profile={profile} />

      {seasonBoard ? (
        <SeasonSectionsPanel
          key={`${seasonBoard.currentSeason?.id ?? "none"}-${(seasonBoard.currentSeason?.sections ?? [])
            .map((section) => `${section.id}:${section.sunExposure}:${section.sunExposureSource}`)
            .join("|")}`}
          board={seasonBoard}
        />
      ) : (
        <section className="rounded-2xl border border-dashed bg-neutral-50 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Seasons &amp; bed sections</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Save the garden profile and a complete sun map first. Section
            exposures are derived from those permanent zones.
          </p>
        </section>
      )}

      <CurrentLocationsPanel locations={currentLocations} />

      {seasonBoard && seasonBoard.pastSeasons.length > 0 ? (
        <PreviousSeasonsPanel board={seasonBoard} />
      ) : null}
    </div>
  );
}
