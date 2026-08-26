import type { OpenCareRecommendation } from "@/lib/care/types";

import { completeRecommendation, skipRecommendation } from "./actions";

const buttonClass =
  "min-h-12 flex-1 rounded-lg px-4 font-semibold sm:flex-none";

export function RecommendationCard({
  recommendation,
}: {
  recommendation: OpenCareRecommendation;
}) {
  return (
    <article className="rounded-2xl border bg-white p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-forest">
        {recommendation.headline}
      </h3>
      <p className="mt-2 text-sm leading-6 text-forest">
        {recommendation.rationale}
      </p>
      {recommendation.estimatedMinutes != null ? (
        <p className="mt-2 text-sm text-forest">
          About {recommendation.estimatedMinutes} min
        </p>
      ) : null}
      {recommendation.evidence.facts.length > 0 ? (
        <dl className="mt-3 space-y-1 text-sm text-forest">
          {recommendation.evidence.facts.map((fact) => (
            <div key={`${fact.source}:${fact.figure}`}>
              <dt className="inline font-medium">{fact.source}: </dt>
              <dd className="inline">{fact.figure}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <form action={completeRecommendation} className="flex-1">
          <input
            type="hidden"
            name="recommendationId"
            value={recommendation.id}
          />
          <button
            type="submit"
            className={`${buttonClass} w-full bg-forest text-cream hover:bg-selection`}
            aria-label={`Mark done: ${recommendation.headline}`}
          >
            Done
          </button>
        </form>
        <form action={skipRecommendation} className="flex-1">
          <input
            type="hidden"
            name="recommendationId"
            value={recommendation.id}
          />
          <button
            type="submit"
            className={`${buttonClass} w-full border bg-white text-forest hover:bg-cream`}
            aria-label={`Dismiss: ${recommendation.headline}`}
          >
            Dismiss
          </button>
        </form>
      </div>
    </article>
  );
}
