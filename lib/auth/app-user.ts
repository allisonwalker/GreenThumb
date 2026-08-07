import "server-only";

import { getDatabase } from "@/lib/db/client";
import { appUsers } from "@/lib/db/schema";

export type AuthIdentity = {
  id: string;
  email: string;
};

export async function ensureAppUser(identity: AuthIdentity) {
  const database = getDatabase();

  await database
    .insert(appUsers)
    .values(identity)
    .onConflictDoUpdate({
      target: appUsers.id,
      set: { email: identity.email },
    });

  return identity;
}
