"use server";

import { revalidatePath } from "next/cache";

import { parseConversationKind } from "@/lib/agent/ask-request";
import { clearAskConversation } from "@/lib/agent/ask-turn";
import type { ConversationKind } from "@/lib/agent/conversation";
import { requirePageUser } from "@/lib/auth/session";

export type ClearAskThreadResult =
  | { ok: true }
  | { ok: false; error: string };

export async function clearAskThread(
  kind: ConversationKind,
): Promise<ClearAskThreadResult> {
  const parsed = parseConversationKind(kind);
  if (typeof parsed !== "string") {
    return { ok: false, error: parsed.error };
  }

  const identity = await requirePageUser();
  await clearAskConversation(identity.id, parsed);
  revalidatePath("/ask");
  return { ok: true };
}
