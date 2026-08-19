import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDatabase } from "@/lib/db/client";
import {
  actionLogs,
  appUsers,
  careRuns,
  gardens,
  locations,
  recommendations,
} from "@/lib/db/schema";

import { listOpenRecommendations } from "./list-open";
import {
  dismissRecommendationOnDb,
  markRecommendationDoneOnDb,
  persistMatchingOnDb,
} from "./persist";
import type { MatchingTaskInput } from "./types";

const runDatabaseTests = process.env.RUN_DB_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;

const rollbackMessage = "ROLLBACK_CARE_PERSIST_TEST";
const TIME_ZONE = "America/Los_Angeles";
const AS_OF = new Date("2026-08-19T19:00:00.000Z");

function task(
  locationId: string,
  overrides: Partial<MatchingTaskInput> = {},
): MatchingTaskInput {
  return {
    locationId,
    plantingId: null,
    cropId: null,
    actionType: "watered",
    urgency: "today",
    headline: "Water ALL-20 test pot",
    rationale: "last watered 4 days ago",
    evidence: {
      facts: [{ source: "action_log", figure: "last watered 2026-08-15" }],
    },
    estimatedMinutes: 10,
    dueBy: new Date("2026-08-20T06:59:59.000Z"),
    ...overrides,
  };
}

describeDatabase("care persist repository", () => {
  it("persists matching rows on care_run, lists them, and supersedes on a second run", async () => {
    await expectRollback(async (db) => {
      const garden = await seedGarden(db);

      const first = await persistMatchingOnDb(db, {
        trigger: "manual",
        asOf: AS_OF,
        timeZone: TIME_ZONE,
        tasks: [task(garden.locationId)],
      });

      expect(first.inserted).toBe(1);
      expect(first.superseded).toBe(0);

      const [run] = await db
        .select({
          trigger: careRuns.trigger,
          status: careRuns.status,
          taskCount: careRuns.taskCount,
        })
        .from(careRuns)
        .where(eq(careRuns.id, first.careRunId));

      expect(run).toEqual({
        trigger: "manual",
        status: "succeeded",
        taskCount: 1,
      });

      const open = (await listOpenRecommendations(garden.gardenId, db)).filter(
        (row) => row.locationId === garden.locationId,
      );
      expect(open).toHaveLength(1);
      expect(open[0]?.careRunId).toBe(first.careRunId);
      expect(open[0]?.confidence).toBeNull();
      expect(open[0]?.headline).toBe("Water ALL-20 test pot");

      const [stored] = await db
        .select({
          agentRunId: recommendations.agentRunId,
          careRunId: recommendations.careRunId,
        })
        .from(recommendations)
        .where(eq(recommendations.id, open[0]!.id));

      expect(stored.agentRunId).toBeNull();
      expect(stored.careRunId).toBe(first.careRunId);

      const second = await persistMatchingOnDb(db, {
        trigger: "manual",
        asOf: new Date(AS_OF.getTime() + 60_000),
        timeZone: TIME_ZONE,
        tasks: [
          task(garden.locationId, {
            headline: "Water ALL-20 test pot (updated)",
          }),
        ],
      });

      expect(second.inserted).toBe(1);
      expect(second.superseded).toBe(1);

      const statuses = await db
        .select({
          status: recommendations.status,
          headline: recommendations.headline,
        })
        .from(recommendations)
        .where(eq(recommendations.locationId, garden.locationId));

      expect(statuses).toEqual(
        expect.arrayContaining([
          { status: "superseded", headline: "Water ALL-20 test pot" },
          {
            status: "open",
            headline: "Water ALL-20 test pot (updated)",
          },
        ]),
      );

      const stillOpen = (
        await listOpenRecommendations(garden.gardenId, db)
      ).filter((row) => row.locationId === garden.locationId);
      expect(stillOpen.map((row) => row.headline)).toEqual([
        "Water ALL-20 test pot (updated)",
      ]);
    });
  });

  it("marks done with an action_log row and does not restate that location+action the same day", async () => {
    await expectRollback(async (db) => {
      const garden = await seedGarden(db);
      const userId = crypto.randomUUID();
      await db.insert(appUsers).values({
        id: userId,
        email: `all-20-${userId}@example.com`,
      });

      await persistMatchingOnDb(db, {
        trigger: "manual",
        asOf: AS_OF,
        timeZone: TIME_ZONE,
        tasks: [task(garden.locationId)],
      });

      const [open] = (
        await listOpenRecommendations(garden.gardenId, db)
      ).filter((row) => row.locationId === garden.locationId);
      expect(open).toBeTruthy();

      const done = await markRecommendationDoneOnDb(db, {
        recommendationId: open!.id,
        userId,
        occurredAt: AS_OF,
      });

      const [log] = await db
        .select({
          id: actionLogs.id,
          actionType: actionLogs.actionType,
          locationId: actionLogs.locationId,
        })
        .from(actionLogs)
        .where(eq(actionLogs.id, done.actionLogId));

      expect(log.actionType).toBe("watered");
      expect(log.locationId).toBe(garden.locationId);

      const [row] = await db
        .select({
          status: recommendations.status,
          resolvedActionLogId: recommendations.resolvedActionLogId,
          resolvedBy: recommendations.resolvedBy,
        })
        .from(recommendations)
        .where(eq(recommendations.id, open!.id));

      expect(row.status).toBe("done");
      expect(row.resolvedActionLogId).toBe(done.actionLogId);
      expect(row.resolvedBy).toBe(userId);

      expect(
        (await listOpenRecommendations(garden.gardenId, db)).filter(
          (row) => row.locationId === garden.locationId,
        ),
      ).toEqual([]);

      const again = await persistMatchingOnDb(db, {
        trigger: "after_write",
        asOf: AS_OF,
        timeZone: TIME_ZONE,
        tasks: [task(garden.locationId)],
      });

      expect(again.inserted).toBe(0);
      expect(
        (await listOpenRecommendations(garden.gardenId, db)).filter(
          (row) => row.locationId === garden.locationId,
        ),
      ).toEqual([]);
    });
  });

  it("dismisses without a log row and does not restate the same day", async () => {
    await expectRollback(async (db) => {
      const garden = await seedGarden(db);
      const userId = crypto.randomUUID();
      await db.insert(appUsers).values({
        id: userId,
        email: `all-20-dismiss-${userId}@example.com`,
      });

      await persistMatchingOnDb(db, {
        trigger: "manual",
        asOf: AS_OF,
        timeZone: TIME_ZONE,
        tasks: [task(garden.locationId)],
      });

      const [open] = (
        await listOpenRecommendations(garden.gardenId, db)
      ).filter((row) => row.locationId === garden.locationId);
      await dismissRecommendationOnDb(db, {
        recommendationId: open!.id,
        userId,
        occurredAt: AS_OF,
      });

      const [row] = await db
        .select({
          status: recommendations.status,
          resolvedActionLogId: recommendations.resolvedActionLogId,
        })
        .from(recommendations)
        .where(eq(recommendations.id, open!.id));

      expect(row.status).toBe("dismissed");
      expect(row.resolvedActionLogId).toBeNull();

      const logs = await db
        .select({ id: actionLogs.id })
        .from(actionLogs)
        .where(eq(actionLogs.locationId, garden.locationId));
      expect(logs).toEqual([]);

      const again = await persistMatchingOnDb(db, {
        trigger: "after_write",
        asOf: AS_OF,
        timeZone: TIME_ZONE,
        tasks: [task(garden.locationId)],
      });
      expect(again.inserted).toBe(0);
    });
  });

  it("expires open rows past their due window instead of leaving them open", async () => {
    await expectRollback(async (db) => {
      const garden = await seedGarden(db);

      await persistMatchingOnDb(db, {
        trigger: "manual",
        asOf: new Date("2026-08-17T19:00:00.000Z"),
        timeZone: TIME_ZONE,
        tasks: [
          task(garden.locationId, {
            dueBy: new Date("2026-08-18T06:59:59.000Z"),
            headline: "Stale water",
          }),
        ],
      });

      const expired = await persistMatchingOnDb(db, {
        trigger: "scheduled",
        asOf: AS_OF,
        timeZone: TIME_ZONE,
        tasks: [],
      });

      expect(expired.expired).toBeGreaterThanOrEqual(1);
      expect(expired.inserted).toBe(0);

      const [row] = await db
        .select({ status: recommendations.status })
        .from(recommendations)
        .where(
          and(
            eq(recommendations.locationId, garden.locationId),
            eq(recommendations.headline, "Stale water"),
          ),
        );

      expect(row.status).toBe("expired");
      expect(
        (await listOpenRecommendations(garden.gardenId, db)).filter(
          (row) => row.locationId === garden.locationId,
        ),
      ).toEqual([]);
    });
  });
});

type Tx = Parameters<
  Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
>[0];

async function expectRollback(operation: (tx: Tx) => Promise<unknown>) {
  await expect(
    getDatabase().transaction(async (tx) => {
      await operation(tx);
      throw new Error(rollbackMessage);
    }),
  ).rejects.toThrow(rollbackMessage);
}

async function seedGarden(tx: Tx) {
  const [garden] = await tx.select({ id: gardens.id }).from(gardens).limit(1);
  if (!garden) {
    throw new Error("Expected a garden row for care persist tests");
  }

  const [pot] = await tx
    .insert(locations)
    .values({
      gardenId: garden.id,
      kind: "pot",
      name: "ALL-20 persist test pot",
      sunExposure: "full_sun",
      sunExposureSource: "override",
      volumeGal: "10",
      material: "terracotta",
      soilType: "potting mix",
      drynessFactor: "1.5",
    })
    .returning({ id: locations.id });

  return { gardenId: garden.id, locationId: pot.id };
}
