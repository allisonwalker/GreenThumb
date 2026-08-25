import { runAgent } from "../lib/agent";
import {
  TIME_BUDGET_EVAL_GRADERS,
  TIME_BUDGET_EVAL_PROMPTS,
  createTimeBudgetEvalRegistry,
  countGardenWriteTables,
  type TimeBudgetEvalCaseId,
} from "../lib/agent/evals";
import { resolveLlmProvider } from "../lib/llm";
import {
  formatMs,
  formatTokens,
  formatUsd,
  ink,
  passFail,
  printTable,
  truncate,
} from "./eval-report";

const CASE_IDS = [
  "case1",
  "case2",
  "case3",
  "case4",
  "case5",
] as const satisfies TimeBudgetEvalCaseId[];

type CaseRow = {
  caseId: TimeBudgetEvalCaseId;
  prompt: string;
  ok: boolean;
  failures: string[];
  status: string;
  tools: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  finalText: string;
  error: string | null;
};

async function main() {
  const provider = resolveLlmProvider();
  const registry = createTimeBudgetEvalRegistry();
  const canCount = Boolean(process.env.DATABASE_URL);
  const recordRun = canCount;

  console.log(`Time-budget contract eval via LLM_PROVIDER=${provider}`);
  if (!canCount) {
    console.log(
      "DATABASE_URL unset — skipping planting/recommendation/action_log/crop counts and agent_run recording.",
    );
  }
  console.log("---");
  console.log(ink.dim("Running cases…"));

  const rows: CaseRow[] = [];

  for (const [index, caseId] of CASE_IDS.entries()) {
    const prompt = TIME_BUDGET_EVAL_PROMPTS[caseId];
    const before = canCount ? await countGardenWriteTables() : null;
    const started = Date.now();

    const result = await runAgent({
      kind: "time_budget",
      trigger: `scripts/eval-time-budget.ts:${caseId}`,
      prompt,
      registry,
      recordRun,
    });

    const after = canCount ? await countGardenWriteTables() : null;
    const grade = TIME_BUDGET_EVAL_GRADERS[caseId](result, before, after);
    const row: CaseRow = {
      caseId,
      prompt,
      ok: grade.ok,
      failures: grade.failures,
      status: result.status,
      tools: result.toolTrace.map((entry) => entry.name).join(",") || "(none)",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      latencyMs: Date.now() - started,
      finalText: result.finalText,
      error: result.error ?? null,
    };
    rows.push(row);
    console.log(
      `  ${index + 1}/${CASE_IDS.length}  ${caseId.padEnd(8)} ${passFail(row.ok)}  ${formatMs(row.latencyMs)}`,
    );
  }

  const failed = rows.filter((row) => !row.ok).length;
  const inputTokens = rows.reduce((sum, row) => sum + row.inputTokens, 0);
  const outputTokens = rows.reduce((sum, row) => sum + row.outputTokens, 0);
  const estimatedCostUsd = rows.reduce(
    (sum, row) => sum + row.estimatedCostUsd,
    0,
  );
  const latencyMs = rows.reduce((sum, row) => sum + row.latencyMs, 0);

  console.log("");
  printTable(
    ["id", "ok", "status", "latency", "tokens", "cost", "tools"],
    rows.map((row) => [
      row.caseId,
      passFail(row.ok),
      row.status,
      formatMs(row.latencyMs),
      formatTokens(row.inputTokens, row.outputTokens),
      formatUsd(row.estimatedCostUsd),
      row.tools,
    ]),
  );

  const withNotes = rows.filter(
    (row) => !row.ok || row.failures.length > 0 || row.error,
  );
  if (withNotes.length > 0) {
    console.log("");
    console.log(ink.bold("Failures"));
    for (const row of withNotes) {
      console.log(`  ${ink.red(row.caseId)} — ${row.prompt}`);
      for (const failure of row.failures) {
        console.log(`    · ${failure}`);
      }
      if (row.error) {
        console.log(`    error: ${row.error}`);
      }
      if (row.finalText) {
        console.log(`    ${ink.dim(`reply: ${truncate(row.finalText, 180)}`)}`);
      }
    }
  }

  console.log("");
  printTable(
    ["scored", "passed", "failed", "tokens in/out", "cost", "latency"],
    [
      [
        String(rows.length),
        ink.green(String(rows.length - failed)),
        failed > 0 ? ink.red(String(failed)) : "0",
        formatTokens(inputTokens, outputTokens),
        formatUsd(estimatedCostUsd),
        formatMs(latencyMs),
      ],
    ],
  );

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
