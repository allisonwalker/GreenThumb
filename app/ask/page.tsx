import { loadAskMessages } from "@/lib/agent/ask-turn";
import { requirePageUser } from "@/lib/auth/session";

import { AskThread } from "./ask-thread";

export default async function AskPage() {
  const identity = await requirePageUser();
  const messages = await loadAskMessages(identity.id);

  return <AskThread initialMessages={messages} />;
}
