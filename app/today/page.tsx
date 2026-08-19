import Link from "next/link";

import { requirePageUser } from "@/lib/auth/session";
import { listOpenRecommendationsForSingletonGarden } from "@/lib/care/list-open";
import { groupOpenByUrgency } from "@/lib/care/persist-decisions";
import { URGENCY_LABELS } from "@/lib/care/types";

import { RecommendationCard } from "./recommendation-card";

export default async function TodayPage() {
  await requirePageUser();
  const open = await listOpenRecommendationsForSingletonGarden();
  const groups = groupOpenByUrgency(open);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Today
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Open garden tasks
        </h1>
        <p className="mt-3 text-neutral-600">
          Mark a task done when you do it — that writes the care log so the
          next matching run does not ask again. Dismiss leaves the log alone.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="rounded-2xl border bg-white px-4 py-6 text-neutral-600 shadow-sm">
          Nothing open.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.urgency} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-green-800">
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

      <p className="text-neutral-600">
        Short on time?{" "}
        <Link
          href="/ask?mode=hours"
          className="font-semibold text-green-800 underline"
        >
          Say how many hours you have
        </Link>{" "}
        and we will cut the open list into must-do vs if-you-have-time. That
        screen does not change Today — mark work done here.
      </p>
    </div>
  );
}
