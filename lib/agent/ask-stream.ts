export type AskStreamEvent =
  | { type: "token"; text: string }
  | {
      type: "done";
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
      agentRunId: string | null;
      stopReason: string;
      content: string;
    }
  | { type: "error"; message: string };

export function encodeAskStreamEvent(event: AskStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseAskStreamBuffer(buffer: string): {
  events: AskStreamEvent[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks = normalized.split("\n\n");
  const rest = chunks.pop() ?? "";
  const events: AskStreamEvent[] = [];
  for (const chunk of chunks) {
    events.push(...parseAskStreamChunk(chunk));
  }
  return { events, rest };
}

function parseAskStreamChunk(chunk: string): AskStreamEvent[] {
  const events: AskStreamEvent[] = [];
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }
    const raw = trimmed.slice("data:".length).trim();
    if (!raw) {
      continue;
    }
    events.push(JSON.parse(raw) as AskStreamEvent);
  }
  return events;
}
