"use client";

import { useEffect, useRef, useState } from "react";

import { parseAskStreamBuffer, type AskStreamEvent } from "@/lib/agent/ask-stream";
import type { ConversationKind, MessageRecord } from "@/lib/agent/conversation";
import { formatTimeBudgetPrompt } from "@/lib/agent/time-budget-prompt";

const fieldClass =
  "min-h-12 w-full resize-none rounded-lg border bg-white px-3 py-3 text-base shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200";

type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentRunId: string | null;
};

type AskMode = ConversationKind;

export function AskThread({
  initialAskMessages,
  initialTimeBudgetMessages,
  initialMode = "ask",
}: {
  initialAskMessages: MessageRecord[];
  initialTimeBudgetMessages: MessageRecord[];
  initialMode?: AskMode;
}) {
  const [mode, setMode] = useState<AskMode>(initialMode);
  const [askMessages, setAskMessages] = useState<ThreadMessage[]>(
    initialAskMessages.map(toThreadMessage),
  );
  const [timeBudgetMessages, setTimeBudgetMessages] = useState<ThreadMessage[]>(
    initialTimeBudgetMessages.map(toThreadMessage),
  );
  const [draft, setDraft] = useState("");
  const [saturdayHours, setSaturdayHours] = useState("2");
  const [sundayHours, setSundayHours] = useState("2");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = mode === "ask" ? askMessages : timeBudgetMessages;
  const setMessages = mode === "ask" ? setAskMessages : setTimeBudgetMessages;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending, mode]);

  async function sendPrompt(prompt: string) {
    if (!prompt || pending) {
      return;
    }

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
        body: JSON.stringify({ prompt, kind: mode }),
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

  async function onAskSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    setDraft("");
    await sendPrompt(prompt);
  }

  async function onHoursSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formatted = formatTimeBudgetPrompt({
      saturdayHours: Number(saturdayHours),
      sundayHours: Number(sundayHours),
    });
    if ("error" in formatted) {
      setError(formatted.error);
      return;
    }
    await sendPrompt(formatted.prompt);
  }

  const hoursReady =
    Number(saturdayHours) > 0 || Number(sundayHours) > 0;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-2xl flex-col">
      <header className="shrink-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Ask
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {mode === "ask"
            ? "Questions about this garden"
            : "Hours I have"}
        </h1>
        <p className="mt-3 text-neutral-600">
          {mode === "ask"
            ? "Answers come from your catalog, plantings, weather, and Today list — not a generic chatbot."
            : "Say Saturday and Sunday hours. We'll cut the open Today list into must-do vs if-you-have-time. This screen does not change the list — mark work done on Today."}
        </p>
        <div
          role="tablist"
          aria-label="Ask mode"
          className="mt-4 grid grid-cols-2 gap-2"
        >
          <ModeTab
            selected={mode === "ask"}
            disabled={pending}
            onSelect={() => {
              setMode("ask");
              setError(null);
            }}
          >
            Questions
          </ModeTab>
          <ModeTab
            selected={mode === "time_budget"}
            disabled={pending}
            onSelect={() => {
              setMode("time_budget");
              setError(null);
            }}
          >
            Hours I have
          </ModeTab>
        </div>
      </header>

      <div
        ref={listRef}
        className="mt-6 min-h-0 flex-1 space-y-3 overflow-y-auto pb-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="rounded-2xl border bg-white p-5 text-sm text-neutral-600 shadow-sm">
            {mode === "ask"
              ? "Ask anything about this garden. The answer will stream in here, and the thread stays when you come back."
              : "Enter hours below. The cut streams in here and stays when you come back. Mark tasks done on Today, not here."}
          </p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              data-role={message.role}
              data-agent-run-id={message.agentRunId ?? undefined}
              data-kind={mode}
              className={
                message.role === "user"
                  ? "ml-8 rounded-2xl bg-green-800 px-4 py-3 text-white"
                  : "mr-8 rounded-2xl border bg-white px-4 py-3 text-neutral-900 shadow-sm"
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {message.role === "user" ? "You" : "Jory Journal"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-base leading-6">
                {message.content ||
                  (pending
                    ? mode === "ask"
                      ? "Looking at your garden…"
                      : "Cutting today's list…"
                    : "")}
              </p>
            </article>
          ))
        )}
      </div>

      {mode === "ask" ? (
        <form
          onSubmit={onAskSubmit}
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
          <ComposerFooter
            error={error}
            pending={pending}
            capped={capped}
            disabled={draft.trim().length === 0}
            pendingLabel="Asking…"
            submitLabel="Ask"
          />
        </form>
      ) : (
        <form
          onSubmit={onHoursSubmit}
          className="sticky bottom-20 shrink-0 space-y-3 border-t bg-[var(--background)] pt-4 md:bottom-0"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Saturday hours
              <input
                className={`${fieldClass} mt-2`}
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.5}
                value={saturdayHours}
                onChange={(event) => setSaturdayHours(event.target.value)}
                disabled={pending || capped}
                name="saturdayHours"
              />
            </label>
            <label className="block text-sm font-medium">
              Sunday hours
              <input
                className={`${fieldClass} mt-2`}
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.5}
                value={sundayHours}
                onChange={(event) => setSundayHours(event.target.value)}
                disabled={pending || capped}
                name="sundayHours"
              />
            </label>
          </div>
          <ComposerFooter
            error={error}
            pending={pending}
            capped={capped}
            disabled={!hoursReady}
            pendingLabel="Planning…"
            submitLabel="Plan my hours"
          />
        </form>
      )}
    </div>
  );
}

function ModeTab({
  selected,
  disabled,
  onSelect,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className={
        selected
          ? "min-h-12 rounded-lg bg-green-800 px-3 text-sm font-semibold text-white"
          : "min-h-12 rounded-lg border bg-white px-3 text-sm font-semibold text-neutral-700"
      }
    >
      {children}
    </button>
  );
}

function ComposerFooter({
  error,
  pending,
  capped,
  disabled,
  pendingLabel,
  submitLabel,
}: {
  error: string | null;
  pending: boolean;
  capped: boolean;
  disabled: boolean;
  pendingLabel: string;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-sm text-red-700">
        {error}
      </p>
      <button
        type="submit"
        disabled={pending || capped || disabled}
        className="min-h-12 rounded-lg bg-green-800 px-6 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
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
