"use client";

import { useEffect, useRef, useState } from "react";

import { parseAskStreamBuffer, type AskStreamEvent } from "@/lib/agent/ask-stream";
import type { MessageRecord } from "@/lib/agent/conversation";

const fieldClass =
  "min-h-12 w-full resize-none rounded-lg border bg-white px-3 py-3 text-base shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200";

type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentRunId: string | null;
};

export function AskThread({
  initialMessages,
}: {
  initialMessages: MessageRecord[];
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(
    initialMessages.map(toThreadMessage),
  );
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || pending) {
      return;
    }

    setDraft("");
    setError(null);
    setPending(true);
    setMessages((current) => [
      ...current,
      { id: `local-user-${Date.now()}`, role: "user", content: prompt, agentRunId: null },
      { id: `local-assistant-${Date.now()}`, role: "assistant", content: "", agentRunId: null },
    ]);

    try {
      const response = await fetch("/api/agent/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not send that question.");
      }

      await readAskStream(response.body, (event) => {
        if (event.type === "token") {
          setMessages((current) => appendToken(current, event.text));
          return;
        }
        if (event.type === "error") {
          setError(event.message);
          return;
        }
        setMessages((current) =>
          finalizeAssistant(current, {
            id: event.assistantMessageId,
            agentRunId: event.agentRunId,
          }),
        );
        if (event.stopReason === "daily_qa_cap") {
          setCapped(true);
        }
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not send that question.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-2xl flex-col">
      <header className="shrink-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Ask
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Questions about this garden
        </h1>
        <p className="mt-3 text-neutral-600">
          Answers come from your catalog, plantings, weather, and Today list —
          not a generic chatbot.
        </p>
      </header>

      <div
        ref={listRef}
        className="mt-6 min-h-0 flex-1 space-y-3 overflow-y-auto pb-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="rounded-2xl border bg-white p-5 text-sm text-neutral-600 shadow-sm">
            Ask anything about this garden. The answer will stream in here, and
            the thread stays when you come back.
          </p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              data-role={message.role}
              data-agent-run-id={message.agentRunId ?? undefined}
              className={
                message.role === "user"
                  ? "ml-8 rounded-2xl bg-green-800 px-4 py-3 text-white"
                  : "mr-8 rounded-2xl border bg-white px-4 py-3 text-neutral-900 shadow-sm"
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {message.role === "user" ? "You" : "GreenThumb"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-base leading-6">
                {message.content || (pending ? "Looking at your garden…" : "")}
              </p>
            </article>
          ))
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-20 shrink-0 space-y-3 border-t bg-[var(--background)] pt-4 md:bottom-0"
      >
        <label className="block text-sm font-medium">
          Your question
          <textarea
            className={`${fieldClass} mt-2`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            required
            disabled={pending || capped}
            placeholder="Should I water the peppers today?"
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="text-sm text-red-700">
            {error}
          </p>
          <button
            type="submit"
            disabled={pending || capped || draft.trim().length === 0}
            className="min-h-12 rounded-lg bg-green-800 px-6 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
          >
            {pending ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}

function toThreadMessage(message: MessageRecord): ThreadMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    agentRunId: message.agentRunId,
  };
}

function appendToken(messages: ThreadMessage[], text: string): ThreadMessage[] {
  const next = [...messages];
  const last = next[next.length - 1];
  if (!last || last.role !== "assistant") {
    return next;
  }
  next[next.length - 1] = { ...last, content: last.content + text };
  return next;
}

function finalizeAssistant(
  messages: ThreadMessage[],
  input: { id: string; agentRunId: string | null },
): ThreadMessage[] {
  const next = [...messages];
  const last = next[next.length - 1];
  if (!last || last.role !== "assistant") {
    return next;
  }
  next[next.length - 1] = {
    ...last,
    id: input.id,
    agentRunId: input.agentRunId,
  };
  return next;
}

async function readAskStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AskStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseAskStreamBuffer(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) {
      onEvent(event);
    }
  }

  if (buffer.trim()) {
    const parsed = parseAskStreamBuffer(`${buffer}\n\n`);
    for (const event of parsed.events) {
      onEvent(event);
    }
  }
}
