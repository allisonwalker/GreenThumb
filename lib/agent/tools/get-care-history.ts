import { and, desc, gte, inArray } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { actionLogs, currentLocations } from "@/lib/db/schema";

import type { ToolExecutionContext } from "./types";

export type CareHistoryEntry = {
  id: string;
  locationId: string | null;
  plantingId: string | null;
  actionType: string;
  occurredAt: string;
  detail: string | null;
  userId: string;
};

export type CareHistoryResult = {
  days: number;
  entries: CareHistoryEntry[];
};

export type CareHistoryStore = {
  list(input: {
    gardenId?: string;
    days: number;
    now: Date;
  }): Promise<CareHistoryResult>;
};

export function createCareHistoryStore(): CareHistoryStore {
  return {
    async list({ gardenId, days, now }) {
      const database = getDatabase();
      const since = new Date(now.getTime() - days * 86_400_000);

      const locationRows = await database
        .select({
          id: currentLocations.id,
          gardenId: currentLocations.gardenId,
        })
        .from(currentLocations);
      const locationIds = locationRows
        .filter((row) => (gardenId ? row.gardenId === gardenId : true))
        .map((row) => row.id!)
        .filter(Boolean);

      if (locationIds.length === 0) {
        return { days, entries: [] };
      }

      const rows = await database
        .select({
          id: actionLogs.id,
          locationId: actionLogs.locationId,
          plantingId: actionLogs.plantingId,
          actionType: actionLogs.actionType,
          occurredAt: actionLogs.occurredAt,
          detail: actionLogs.detail,
          userId: actionLogs.userId,
        })
        .from(actionLogs)
        .where(
          and(
            inArray(actionLogs.locationId, locationIds),
            gte(actionLogs.occurredAt, since),
          ),
        )
        .orderBy(desc(actionLogs.occurredAt));

      return {
        days,
        entries: rows.map((row) => ({
          id: row.id,
          locationId: row.locationId,
          plantingId: row.plantingId,
          actionType: row.actionType,
          occurredAt: row.occurredAt.toISOString(),
          detail: row.detail,
          userId: row.userId,
        })),
      };
    },
  };
}

export async function getCareHistory(
  input: ToolExecutionContext & { days?: number } = {},
  store: CareHistoryStore = createCareHistoryStore(),
): Promise<CareHistoryResult> {
  const days = input.days ?? 30;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("days must be an integer between 1 and 365");
  }

  return store.list({
    gardenId: input.gardenId,
    days,
    now: input.now ?? new Date(),
  });
}
