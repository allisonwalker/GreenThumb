import { requirePageUser } from "@/lib/auth/session";
import { getGardenProfileRecord } from "@/lib/garden/profile-repository";

import { GardenProfileForm } from "./garden-profile-form";

export default async function GardenPage() {
  await requirePageUser();
  const profile = await getGardenProfileRecord();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Garden setup
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Your garden profile
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Set the location, raised-bed details, and permanent sun pattern that
          GreenThumb will use for weather-aware care.
        </p>
      </header>
      <GardenProfileForm profile={profile} />
    </div>
  );
}
