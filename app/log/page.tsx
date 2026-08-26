import { requirePageUser } from "@/lib/auth/session";
import {
  listActionLogHistory,
  listLoggableLocations,
} from "@/lib/garden/action-log-repository";
import { lastCareByLocation } from "@/lib/garden/last-care";
import { localDateTimeString } from "@/lib/garden/local-date";
import { getGardenProfileRecord } from "@/lib/garden/profile-repository";

import { LogActionForm } from "./log-action-form";
import { LogHistory } from "./log-history";

export default async function LogPage() {
  await requirePageUser();
  const locations = await listLoggableLocations();
  const profile = await getGardenProfileRecord();
  const timeZone = profile?.timezone ?? "America/Los_Angeles";
  const history = await listActionLogHistory({});
  const lastCare = lastCareByLocation(
    history.map((entry) => ({
      locationId: entry.locationId,
      actionType: entry.actionType,
      occurredAt: entry.occurredAt,
      voided: entry.voided,
    })),
    locations.map((location) => location.id),
    timeZone,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Care log
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          What we already did
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Record watering, feeding, pruning, harvest, and notes so both of you
          — and later, the daily list — know what happened.
        </p>
      </header>
      <LogActionForm
        locations={locations}
        timeZone={timeZone}
        nowLocal={localDateTimeString(new Date(), timeZone)}
      />
      <LogHistory
        entries={history}
        locations={locations}
        timeZone={timeZone}
        lastCare={lastCare}
      />
    </div>
  );
}
