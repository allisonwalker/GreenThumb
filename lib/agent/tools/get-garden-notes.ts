import { asc, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { gardenNotes } from "@/lib/db/schema";

import { createGardenProfileStore } from "./get-garden-profile";
import type { ToolExecutionContext } from "./types";

export type GardenNoteSummary = {
  id: string;
  note: string;
  userId: string;
  createdAt: string;
};

export type GardenNotesStore = {
  list(gardenId: string): Promise<GardenNoteSummary[]>;
};

export function createGardenNotesStore(): GardenNotesStore {
  return {
    async list(gardenId) {
      const database = getDatabase();
      const rows = await database
        .select({
          id: gardenNotes.id,
          note: gardenNotes.note,
          userId: gardenNotes.userId,
          createdAt: gardenNotes.createdAt,
        })
        .from(gardenNotes)
        .where(eq(gardenNotes.gardenId, gardenId))
        .orderBy(asc(gardenNotes.createdAt));

      return rows.map((row) => ({
        id: row.id,
        note: row.note,
        userId: row.userId,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}

export async function getGardenNotes(
  context: ToolExecutionContext = {},
  store: GardenNotesStore = createGardenNotesStore(),
  profileStore = createGardenProfileStore(),
): Promise<GardenNoteSummary[]> {
  const profile = await profileStore.getProfile(context.gardenId);
  return store.list(profile.gardenId);
}
