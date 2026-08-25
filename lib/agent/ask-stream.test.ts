import { describe, expect, it } from "vitest";

import {
  encodeAskStreamEvent,
  parseAskStreamBuffer,
} from "./ask-stream";
import {
  DEFAULT_DAILY_QA_CAP,
  isDailyQaCapExceeded,
  resolveDailyQaCap,
} from "./qa-cap";
import { parseAskRequestBody } from "./ask-request";

describe("Ask stream encoding", () => {
  it("round-trips token events so the UI can append incrementally", () => {
    const encoded = `${encodeAskStreamEvent({ type: "token", text: "Hello" })}${encodeAskStreamEvent({ type: "token", text: " garden" })}`;
    const parsed = parseAskStreamBuffer(encoded);
    expect(parsed.events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " garden" },
    ]);
    expect(parsed.rest).toBe("");
  });

  it("parses CRLF-delimited events without treating two JSON objects as one", () => {
    const encoded =
      'data: {"type":"token","text":"Hello"}\r\n\r\ndata: {"type":"token","text":" garden"}\r\n\r\n';
    expect(parseAskStreamBuffer(encoded).events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " garden" },
    ]);
  });
});

describe("daily Q&A cap", () => {
  it("defaults to a positive integer and treats count at the cap as exceeded", () => {
    expect(resolveDailyQaCap(undefined)).toBe(DEFAULT_DAILY_QA_CAP);
    expect(isDailyQaCapExceeded(19, 20)).toBe(false);
    expect(isDailyQaCapExceeded(20, 20)).toBe(true);
  });
});

describe("Ask request body", () => {
  it("rejects a blank prompt before a model call", () => {
    expect(parseAskRequestBody({})).toEqual({ error: "Expected a prompt" });
    expect(parseAskRequestBody({ prompt: "   " })).toEqual({
      error: "Ask a question about this garden first.",
    });
    expect(parseAskRequestBody({ prompt: " Do peppers want sun? " })).toEqual({
      prompt: "Do peppers want sun?",
      kind: "ask",
    });
    expect(
      parseAskRequestBody({
        prompt: "I have two hours Saturday.",
        kind: "time_budget",
      }),
    ).toEqual({
      prompt: "I have two hours Saturday.",
      kind: "time_budget",
    });
    expect(
      parseAskRequestBody({ prompt: "I have two hours Saturday.", kind: "write" }),
    ).toEqual({ error: "Expected kind to be ask or time_budget." });
  });
});
