import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ASK_EVAL_PROMPTS,
  ASK_EVAL_PROMPT_VERSION,
  runAgent,
  type AskEvalPromptVersion,
} from "../lib/agent";
import {
  ASK_EVAL_CASES,
  ASK_EVAL_DATASET_VERSION,
  ASK_EVAL_GRADER_ID,
  createAskEvalRegistry,
  countGardenWriteTables,
  gradeAskCase,
  type AskCriterionId,
  type AskEvalCase,
  type AskGrade,
} from "../lib/agent/evals";
import { resolveLlmProvider } from "../lib/llm";

const CRITERIA: AskCriterionId[] = ["C1", "C2", "C3", "C4", "C5"];

type CaseRecord = {
  caseId: string;
  tags: AskEvalCase["tags"];
  category: AskEvalCase["category"];
  holdout: boolean;
  prompt: string;
  promptVersion: string;
  provider: string;
  model: string;
  datasetVersion: string;
  grader: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  toolTrace: string[];
  finalText: string;
  error: string | null;
  stopReason: string | null;
  criteria: AskGrade["criteria"];
  ok: boolean;
  failures: string[];
};

async function main() {
  const { includeHoldout, onlyId } = parseArgs(process.argv.slice(2));
  const promptVersion = resolvePromptVersion();
  const systemPrompt = ASK_EVAL_PROMPTS[promptVersion];

  const selected = selectCases(includeHoldout, onlyId);
  const provider = resolveLlmProvider();
  const registry = createAskEvalRegistry();
  const canCount = Boolean(process.env.DATABASE_URL);
  const recordRun = process.env.ASK_EVAL_RECORD === "1";
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join("docs", "evals", "ask", "runs", runId);
  const casesDir = path.join(runDir, "cases");
  await mkdir(casesDir, { recursive: true });

  const startedAt = new Date().toISOString();
  console.log(
    `Ask eval ${ASK_EVAL_DATASET_VERSION} via LLM_PROVIDER=${provider} prompt=${promptVersion} grader=${ASK_EVAL_GRADER_ID}`,
  );
  console.log(`runId=${runId}  cases=${selected.map((item) => item.id).join(", ")}`);
  if (!canCount) {
    console.log(
      "DATABASE_URL unset — skipping planting/recommendation/action_log/crop counts.",
    );
  }
  if (!recordRun) {
    console.log("ASK_EVAL_RECORD unset — not writing agent_run rows.");
  }
  console.log("---");

  const pauseMs = Number(process.env.ASK_EVAL_PAUSE_MS ?? "0");
  const records: CaseRecord[] = [];
  let model = "";

  for (const [index, evalCase] of selected.entries()) {
    if (index > 0 && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    const before = canCount ? await countGardenWriteTables() : null;
    const started = Date.now();
    let record: CaseRecord;
    try {
      const result = await runAgent({
        kind: "ask",
        trigger: `scripts/eval-ask.ts:${evalCase.id}`,
        prompt: evalCase.prompt,
        registry,
        recordRun,
        systemPrompt,
      });
      const after = canCount ? await countGardenWriteTables() : null;
      const grade = gradeAskCase(evalCase, result, before, after);
      model = result.model;
      record = {
        caseId: evalCase.id,
        tags: evalCase.tags,
        category: evalCase.category,
        holdout: evalCase.holdout,
        prompt: evalCase.prompt,
        promptVersion,
        provider: result.provider,
        model: result.model,
        datasetVersion: ASK_EVAL_DATASET_VERSION,
        grader: ASK_EVAL_GRADER_ID,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        latencyMs: Date.now() - started,
        toolTrace: result.toolTrace.map((entry) => entry.name),
        finalText: result.finalText,
        error: result.error ?? null,
        stopReason: result.stopReason,
        criteria: grade.criteria,
        ok: grade.ok,
        failures: grade.failures,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const grade = gradeAskCase(
        evalCase,
        { kind: "ask", toolTrace: [], finalText: "" },
        null,
        null,
      );
      record = {
        caseId: evalCase.id,
        tags: evalCase.tags,
        category: evalCase.category,
        holdout: evalCase.holdout,
        prompt: evalCase.prompt,
        promptVersion,
        provider,
        model: model || "(unknown)",
        datasetVersion: ASK_EVAL_DATASET_VERSION,
        grader: ASK_EVAL_GRADER_ID,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - started,
        toolTrace: [],
        finalText: "",
        error: message,
        stopReason: "error",
        criteria: grade.criteria,
        ok: false,
        failures: [`run error: ${message}`, ...grade.failures],
      };
    }

    records.push(record);
    await writeFile(
      path.join(casesDir, `${evalCase.id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }

  const scored = records.length;
  const failed = records.filter((item) => !item.ok).length;
  const c3Failed = records.filter((item) => item.criteria.C3 === false).length;
  const inputTokens = records.reduce((sum, item) => sum + item.inputTokens, 0);
  const outputTokens = records.reduce((sum, item) => sum + item.outputTokens, 0);
  const estimatedCostUsd = records.reduce(
    (sum, item) => sum + item.estimatedCostUsd,
    0,
  );
  const latencyMs = records.reduce((sum, item) => sum + item.latencyMs, 0);

  const manifest = {
    runId,
    datasetVersion: ASK_EVAL_DATASET_VERSION,
    grader: ASK_EVAL_GRADER_ID,
    promptVersion,
    provider,
    model: model || records[0]?.model || null,
    holdoutIncluded: includeHoldout,
    only: onlyId,
    startedAt,
    finishedAt: new Date().toISOString(),
    totals: {
      scored,
      passed: scored - failed,
      failed,
      c3Failed,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      latencyMs,
    },
    cases: records.map((item) => item.caseId),
  };
  await writeFile(
    path.join(runDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  printTable(records);
  console.log("");
  console.log(
    `scored=${scored} passed=${scored - failed} failed=${failed} C3_failed=${c3Failed} tokens=${inputTokens}/${outputTokens} cost_usd=${estimatedCostUsd.toFixed(6)} latency_ms=${latencyMs}`,
  );
  console.log(`wrote ${runDir}`);

  if (failed > 0 || c3Failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

function resolvePromptVersion(): AskEvalPromptVersion {
  const raw =
    process.env.ASK_EVAL_PROMPT_VERSION?.trim() || ASK_EVAL_PROMPT_VERSION;
  if (raw in ASK_EVAL_PROMPTS) {
    return raw as AskEvalPromptVersion;
  }
  throw new Error(
    `Unknown ASK_EVAL_PROMPT_VERSION "${raw}". Known: ${Object.keys(ASK_EVAL_PROMPTS).join(", ")}`,
  );
}

function parseArgs(args: string[]): { includeHoldout: boolean; onlyId: string | null } {
  let includeHoldout = false;
  let onlyId: string | null = null;
  for (const arg of args) {
    if (arg === "--holdout") {
      includeHoldout = true;
      continue;
    }
    if (arg.startsWith("--only=")) {
      onlyId = arg.slice("--only=".length).trim() || null;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}. Use --holdout and/or --only=<id>.`);
  }
  return { includeHoldout, onlyId };
}

function selectCases(includeHoldout: boolean, onlyId: string | null): AskEvalCase[] {
  if (onlyId) {
    const found = ASK_EVAL_CASES.find((item) => item.id === onlyId);
    if (!found) {
      throw new Error(
        `Unknown Ask eval case "${onlyId}". Known: ${ASK_EVAL_CASES.map((item) => item.id).join(", ")}`,
      );
    }
    return [found];
  }
  if (includeHoldout) {
    return [...ASK_EVAL_CASES];
  }
  return ASK_EVAL_CASES.filter((item) => !item.holdout);
}

function printTable(records: CaseRecord[]) {
  const header = [
    pad("id", 22),
    pad("hold", 5),
    ...CRITERIA.map((id) => pad(id, 4)),
    pad("ok", 6),
    pad("ms", 6),
    "tools",
  ].join("  ");
  console.log(header);
  for (const record of records) {
    const tools = record.toolTrace.join(",") || "(none)";
    console.log(
      [
        pad(record.caseId, 22),
        pad(record.holdout ? "yes" : "no", 5),
        ...CRITERIA.map((id) => pad(formatCriterion(record.criteria[id]), 4)),
        pad(record.ok ? "PASS" : "FAIL", 6),
        pad(String(record.latencyMs), 6),
        tools,
      ].join("  "),
    );
    for (const failure of record.failures) {
      console.log(`  · ${failure}`);
    }
    if (record.error) {
      console.log(`  error: ${record.error}`);
    }
    if (record.finalText) {
      console.log(`  reply: ${truncate(record.finalText, 220)}`);
    }
  }
}

function formatCriterion(value: boolean | "skipped"): string {
  if (value === "skipped") {
    return "—";
  }
  return value ? "ok" : "FAIL";
}

function pad(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }
  return value.padEnd(width);
}

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
