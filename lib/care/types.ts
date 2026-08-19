import type { RecommendationEvidence } from "@/lib/db/schema";

export const CARE_RUN_TRIGGERS = [
  "scheduled",
  "manual",
  "after_write",
  "simulated",
] as const;

export type CareRunTrigger = (typeof CARE_RUN_TRIGGERS)[number];

export const RECOMMENDATION_URGENCIES = [
  "now",
  "today",
  "this_week",
  "monitor",
] as const;

export type RecommendationUrgency = (typeof RECOMMENDATION_URGENCIES)[number];

export const URGENCY_LABELS: Record<RecommendationUrgency, string> = {
  now: "Do now",
  today: "Today",
  this_week: "This week",
  monitor: "Monitor",
};

export type MatchingTaskInput = {
  locationId: string;
  plantingId: string | null;
  cropId: string | null;
  actionType:
    | "watered"
    | "fertilized"
    | "pruned"
    | "harvested"
    | "planted"
    | "observed"
    | "treated";
  urgency: RecommendationUrgency;
  headline: string;
  rationale: string;
  evidence: RecommendationEvidence;
  estimatedMinutes: number | null;
  dueBy: Date | null;
};

export type ExistingRecommendation = {
  id: string;
  locationId: string;
  actionType: string;
  status: "open" | "done" | "dismissed" | "superseded" | "expired";
  dueBy: Date | null;
  resolvedAt: Date | null;
  updatedAt: Date;
};

export type OpenCareRecommendation = {
  id: string;
  careRunId: string | null;
  locationId: string;
  locationName: string;
  plantingId: string | null;
  cropId: string | null;
  actionType: string;
  urgency: RecommendationUrgency;
  headline: string;
  rationale: string;
  confidence: number | null;
  evidence: RecommendationEvidence;
  estimatedMinutes: number | null;
  status: "open";
  dueBy: string | null;
  createdAt: string;
};

export type PersistMatchingInput = {
  trigger: CareRunTrigger;
  asOf: Date;
  timeZone: string;
  tasks: MatchingTaskInput[];
  /** Open rows of these action types that matching did not restate are expired. */
  ownedActionTypes?: MatchingTaskInput["actionType"][];
  weatherFetchId?: string | null;
  simulatedWeather?: unknown;
};
