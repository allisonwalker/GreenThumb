import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDatabase } from "@/lib/db/client";
import {
  actionLogs,
  appUsers,
  currentLocations,
  locations,
} from "@/lib/db/schema";

import type { ActionLogInput } from "./action-log-validation";

export type LoggableLocation = {
  id: string;
  name: string;
  kind: "bed_section" | "pot";
};

export type ActionLogHistoryEntry = {
  id: string;
  locationId: string;
  locationName: string;
  actionType: string;
  occurredAt: Date;
  detail: string | null;
  userId: string;
  loggedByEmail: string;
  voided: boolean;
  voidsId: string | null;
};

export async function listLoggableLocations(): Promise<LoggableLocation[]> {
  const database = getDatabase();
  const rows = await database
    .select({
      id: currentLocations.id,
      name: currentLocations.name,
      kind: currentLocations.kind,
    })
    .from(currentLocations)
    .where(isNull(currentLocations.retiredAt))
    .orderBy(asc(currentLocations.kind), asc(currentLocations.name));

  return rows
    .filter(
      (row): row is { id: string; name: string; kind: "bed_section" | "pot" } =>
        Boolean(row.id && row.name && row.kind),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
    }));
}

export async function listActionLogHistory(input: {
  locationId?: string;
}): Promise<ActionLogHistoryEntry[]> {
  const database = getDatabase();
  const voiding = alias(actionLogs, "voiding_action_log");

  const rows = await database
    .select({
      id: actionLogs.id,
      locationId: actionLogs.locationId,
      locationName: locations.name,
      actionType: actionLogs.actionType,
      occurredAt: actionLogs.occurredAt,
      detail: actionLogs.detail,
      userId: actionLogs.userId,
      loggedByEmail: appUsers.email,
      voidsId: actionLogs.voidsId,
      voidedById: voiding.id,
    })
    .from(actionLogs)
    .innerJoin(locations, eq(actionLogs.locationId, locations.id))
    .innerJoin(appUsers, eq(actionLogs.userId, appUsers.id))
    .leftJoin(voiding, eq(voiding.voidsId, actionLogs.id))
    .where(
      input.locationId
        ? eq(actionLogs.locationId, input.locationId)
        : undefined,
    )
    .orderBy(desc(actionLogs.occurredAt), desc(actionLogs.createdAt));

  return rows
    .filter((row): row is typeof row & { locationId: string } =>
      Boolean(row.locationId),
    )
    .map((row) => ({
      id: row.id,
      locationId: row.locationId,
      locationName: row.locationName,
      actionType: row.actionType,
      occurredAt: row.occurredAt,
      detail: row.detail,
      userId: row.userId,
      loggedByEmail: row.loggedByEmail,
      voided: Boolean(row.voidedById),
      voidsId: row.voidsId,
    }));
}

export async function insertActionLog(
  input: ActionLogInput & { userId: string },
) {
  const database = getDatabase();
  const [location] = await database
    .select({ id: currentLocations.id })
    .from(currentLocations)
    .where(
      and(
        eq(currentLocations.id, input.locationId),
        isNull(currentLocations.retiredAt),
      ),
    )
    .limit(1);

  if (!location?.id) {
    throw new Error("Choose a current pot or bed section.");
  }

  const [row] = await database
    .insert(actionLogs)
    .values({
      locationId: input.locationId,
      userId: input.userId,
      actionType: input.actionType,
      occurredAt: input.occurredAt,
      detail: input.detail,
    })
    .returning({ id: actionLogs.id });

  if (!row) {
    throw new Error("The action could not be logged.");
  }

  return row;
}

export async function voidActionLog(input: {
  actionLogId: string;
  userId: string;
  now?: Date;
}) {
  const database = getDatabase();
  const voiding = alias(actionLogs, "voiding_action_log");
  const [original] = await database
    .select({
      id: actionLogs.id,
      locationId: actionLogs.locationId,
      actionType: actionLogs.actionType,
      voidsId: actionLogs.voidsId,
      voidedById: voiding.id,
    })
    .from(actionLogs)
    .leftJoin(voiding, eq(voiding.voidsId, actionLogs.id))
    .where(eq(actionLogs.id, input.actionLogId))
    .limit(1);

  if (!original?.locationId) {
    throw new Error("That log entry was not found.");
  }
  if (original.voidsId) {
    throw new Error("Correction entries cannot be voided.");
  }
  if (original.voidedById) {
    throw new Error("That entry has already been corrected.");
  }

  const [row] = await database
    .insert(actionLogs)
    .values({
      locationId: original.locationId,
      userId: input.userId,
      actionType: "observed",
      occurredAt: input.now ?? new Date(),
      detail: `Correction: voided mistaken ${original.actionType} entry.`,
      voidsId: original.id,
    })
    .returning({ id: actionLogs.id });

  if (!row) {
    throw new Error("The correction could not be saved.");
  }

  return row;
}
