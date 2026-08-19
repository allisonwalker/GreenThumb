import { describe, expect, it } from "vitest";

import { groupOpenByUrgency, planCarePersist, taskKey } from "./persist-decisions";
import type { ExistingRecommendation, MatchingTaskInput } from "./types";

const TIME_ZONE = "America/Los_Angeles";
const AS_OF = new Date("2026-08-19T19:00:00.000Z");
const LOCATION = "11111111-1111-4111-8111-111111111111";

function task(
  overrides: Partial<MatchingTaskInput> = {},
): MatchingTaskInput {
  return {
    locationId: LOCATION,
    plantingId: null,
    cropId: null,
    actionType: "watered",
    urgency: "today",
    headline: "Section 3 — water today",
    rationale: "last watered 4 days ago",
    evidence: {
      facts: [{ source: "action_log", figure: "last watered 2026-08-15" }],
    },
    estimatedMinutes: 10,
    dueBy: new Date("2026-08-20T06:59:59.000Z"),
    ...overrides,
  };
}

function existing(
  overrides: Partial<ExistingRecommendation>,
): ExistingRecommendation {
  return {
    id: "rec-1",
    locationId: LOCATION,
    actionType: "watered",
    status: "open",
    dueBy: new Date("2026-08-20T06:59:59.000Z"),
    resolvedAt: null,
    updatedAt: new Date("2026-08-19T12:00:00.000Z"),
    ...overrides,
  };
}

describe("planCarePersist", () => {
  it("inserts when nothing exists for that location and action", () => {
    const incoming = task();
    const plan = planCarePersist({
      existing: [],
      tasks: [incoming],
      asOf: AS_OF,
      timeZone: TIME_ZONE,
    });

    expect(plan.expireIds).toEqual([]);
    expect(plan.supersedeIds).toEqual([]);
    expect(plan.inserts).toEqual([incoming]);
  });

  it("supersedes an open row on a second persist of the same location+action", () => {
    const incoming = task({ headline: "Section 3 — water today (updated)" });
    const plan = planCarePersist({
      existing: [existing({ id: "open-1" })],
      tasks: [incoming],
      asOf: AS_OF,
      timeZone: TIME_ZONE,
    });

    expect(plan.supersedeIds).toEqual(["open-1"]);
    expect(plan.inserts).toEqual([incoming]);
  });

  it("does not restate a row marked done on the same garden-local day", () => {
    const plan = planCarePersist({
      existing: [
        existing({
          id: "done-1",
          status: "done",
          resolvedAt: new Date("2026-08-19T16:00:00.000Z"),
        }),
      ],
      tasks: [task()],
      asOf: AS_OF,
      timeZone: TIME_ZONE,
    });

    expect(plan.inserts).toEqual([]);
    expect(plan.supersedeIds).toEqual([]);
  });

  it("does not restate a dismissed row on the same garden-local day", () => {
    const plan = planCarePersist({
      existing: [
        existing({
          id: "dismissed-1",
          status: "dismissed",
          resolvedAt: new Date("2026-08-19T16:00:00.000Z"),
        }),
      ],
      tasks: [task()],
      asOf: AS_OF,
      timeZone: TIME_ZONE,
    });

    expect(plan.inserts).toEqual([]);
  });

  it("does not expire an open row whose due window is still today", () => {
    const plan = planCarePersist({
      existing: [existing({ id: "due-today" })],
      tasks: [],
      asOf: AS_OF,
      timeZone: TIME_ZONE,
    });

    expect(plan.expireIds).toEqual([]);
  });

  it("restates a done row on a later garden-local day", () => {
    const incoming = task();
    const plan = planCarePersist({
      existing: [
        existing({
          id: "done-yesterday",
          status: "done",
          resolvedAt: new Date("2026-08-18T16:00:00.000Z"),
        }),
      ],
      tasks: [incoming],
      asOf: AS_OF,
      timeZone: TIME_ZONE,
    });

    expect(plan.inserts).toEqual([incoming]);
    expect(plan.supersedeIds).toEqual([]);
  });

  it("expires open rows whose due window is a previous garden-local day", () => {
    const stale = existing({
      id: "stale-open",
      dueBy: new Date("2026-08-18T06:59:59.000Z"),
    });
    const plan = planCarePersist({
      existing: [stale],
      tasks: [task()],
      asOf: AS_OF,
      timeZone: TIME_ZONE,
    });

    expect(plan.expireIds).toEqual(["stale-open"]);
    expect(plan.supersedeIds).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
  });

  it("keys location and action together so other actions stay independent", () => {
    expect(taskKey(LOCATION, "watered")).not.toBe(
      taskKey(LOCATION, "fertilized"),
    );
  });
});

describe("groupOpenByUrgency", () => {
  it("groups open rows in urgency order and drops empty buckets", () => {
    const grouped = groupOpenByUrgency([
      {
        id: "b",
        careRunId: "run",
        locationId: LOCATION,
        locationName: "Pot 2",
        plantingId: null,
        cropId: null,
        actionType: "watered",
        urgency: "today",
        headline: "Water later",
        rationale: "",
        confidence: null,
        evidence: { facts: [] },
        estimatedMinutes: null,
        status: "open",
        dueBy: null,
        createdAt: "2026-08-19T00:00:00.000Z",
      },
      {
        id: "a",
        careRunId: "run",
        locationId: LOCATION,
        locationName: "Pot 1",
        plantingId: null,
        cropId: null,
        actionType: "watered",
        urgency: "now",
        headline: "Water now",
        rationale: "",
        confidence: null,
        evidence: { facts: [] },
        estimatedMinutes: null,
        status: "open",
        dueBy: null,
        createdAt: "2026-08-19T00:00:00.000Z",
      },
    ]);

    expect(grouped.map((group) => group.urgency)).toEqual(["now", "today"]);
    expect(grouped[0]?.rows).toHaveLength(1);
  });
});
