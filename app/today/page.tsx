import Link from "next/link";

import { requirePageUser } from "@/lib/auth/session";
import { MICROCLIMATE_LIMITATION } from "@/lib/care/copy";
import { listOpenRecommendationsForSingletonGarden } from "@/lib/care/list-open";
import { groupOpenByUrgency } from "@/lib/care/persist-decisions";
import { runCareMatching } from "@/lib/care/run";
import { URGENCY_LABELS } from "@/lib/care/types";

import { RecommendationCard } from "./recommendation-card";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  await requirePageUser();

  let matchingError: string | null = null;
  try {
    await runCareMatching({ trigger: "manual" });
  } catch (error) {
    console.error("Today matching failed", error);
    matchingError =
      "Could not refresh today's care list. Showing the last saved tasks.";
  }

  const open = await listOpenRecommendationsForSingletonGarden();
  const groups = groupOpenByUrgency(open);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-5xl font-bold leading-none tracking-display text-forest sm:text-6xl">
          Open garden tasks
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-forest">
          Mark a task done when you finish it — that records it in the care log
          so it drops off this list. Dismiss leaves the log as-is.
        </p>
      </header>

      {matchingError ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-forest">
          {matchingError}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="rounded-2xl border bg-white px-4 py-6 text-forest">
          Nothing open.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.urgency} className="space-y-3">
            <h2 className="text-sm font-medium text-forest">
              {URGENCY_LABELS[group.urgency]}
            </h2>
            <ul className="space-y-3">
              {group.rows.map((recommendation) => (
                <li key={recommendation.id}>
                  <RecommendationCard recommendation={recommendation} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="text-forest">
        Short on time?{" "}
        <Link
          href="/ask?mode=hours"
          className="font-semibold text-forest underline"
        >
          Say how many hours you have
        </Link>{" "}
        and we will suggest must-do vs if-you-have-time from this list. Mark
        work done here when you finish it.
      </p>

      <footer className="space-y-2 text-sm text-forest">
        <p>
          Weather data by{" "}
          <a
            href="https://open-meteo.com/"
            className="underline hover:text-selection"
          >
            Open-Meteo
          </a>{" "}
          (CC BY 4.0).
        </p>
        <p>{MICROCLIMATE_LIMITATION}</p>
      </footer>
    </div>
  );
}
