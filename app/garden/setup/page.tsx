import Link from "next/link";

import { requirePageUser } from "@/lib/auth/session";
import { GARDEN_PATH } from "@/lib/garden/routes";
import { getGardenProfileRecord } from "@/lib/garden/profile-repository";
import { getSeasonBoardRecord } from "@/lib/garden/season-repository";

import { GardenProfileForm } from "../garden-profile-form";
import {
  PreviousSeasonsPanel,
  SeasonSectionsPanel,
} from "../season-sections-panel";

export default async function GardenSetupPage() {
  await requirePageUser();
  const [profile, seasonBoard] = await Promise.all([
    getGardenProfileRecord(),
    getSeasonBoardRecord(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <p className="text-sm font-medium text-forest">
          <Link href={GARDEN_PATH} className="underline">
            Garden
          </Link>
          {" · Setup"}
        </p>
        <h1 className="mt-3 text-5xl font-bold leading-none tracking-display text-forest sm:text-6xl">
          Your garden profile
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-forest">
          Set the location and permanent sun map, then draw this season&apos;s
          bed sections. Plantings stay on each location.
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
        <section className="rounded-2xl border border-dashed bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-forest">
            Seasons &amp; bed sections
          </h2>
          <p className="mt-2 text-sm text-forest">
            Save the garden profile and a complete sun map first. Section
            exposures are derived from those permanent zones.
          </p>
        </section>
      )}

      {seasonBoard && seasonBoard.pastSeasons.length > 0 ? (
        <PreviousSeasonsPanel board={seasonBoard} />
      ) : null}
    </div>
  );
}
