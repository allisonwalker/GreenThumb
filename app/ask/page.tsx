import { loadAskMessages } from "@/lib/agent/ask-turn";
import { requirePageUser } from "@/lib/auth/session";

import { AskThread } from "./ask-thread";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const identity = await requirePageUser();
  const params = await searchParams;
  const [askMessages, timeBudgetMessages] = await Promise.all([
    loadAskMessages(identity.id, "ask"),
    loadAskMessages(identity.id, "time_budget"),
  ]);

  return (
    <AskThread
      initialAskMessages={askMessages}
      initialTimeBudgetMessages={timeBudgetMessages}
      initialMode={params.mode === "hours" ? "time_budget" : "ask"}
    />
  );
}
