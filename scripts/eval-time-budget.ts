import { runAgent } from "../lib/agent";
import {
  TIME_BUDGET_EVAL_GRADERS,
  TIME_BUDGET_EVAL_PROMPTS,
  createTimeBudgetEvalRegistry,
  countGardenWriteTables,
  type TimeBudgetEvalCaseId,
} from "../lib/agent/evals";
import { resolveLlmProvider } from "../lib/llm";

const CASE_IDS = [
  "case1",
  "case2",
  "case3",
  "case4",
  "case5",
] as const satisfies TimeBudgetEvalCaseId[];

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

  let failed = 0;

  for (const caseId of CASE_IDS) {
    const prompt = TIME_BUDGET_EVAL_PROMPTS[caseId];
    const before = canCount ? await countGardenWriteTables() : null;

    const result = await runAgent({
      kind: "time_budget",
      trigger: `scripts/eval-time-budget.ts:${caseId}`,
      prompt,
      registry,
      recordRun,
    });

    const after = canCount ? await countGardenWriteTables() : null;
    const grade = TIME_BUDGET_EVAL_GRADERS[caseId](result, before, after);

    console.log(`${caseId} ${grade.ok ? "PASS" : "FAIL"} — ${prompt}`);
    console.log(`  agent_run_id: ${result.agentRunId ?? "(not recorded)"}`);
    console.log(`  status: ${result.status}  tools: ${
      result.toolTrace.map((entry) => entry.name).join(", ") || "(none)"
    }`);
    if (grade.failures.length > 0) {
      for (const failure of grade.failures) {
        console.log(`  · ${failure}`);
      }
      failed += 1;
    }
    if (result.finalText) {
      console.log(`  reply: ${truncate(result.finalText, 280)}`);
    }
    if (result.error) {
      console.log(`  error: ${result.error}`);
    }
    console.log("");
  }

  if (failed > 0) {
    console.log(`${failed} of ${CASE_IDS.length} cases failed.`);
    process.exit(1);
  }

  console.log(`All ${CASE_IDS.length} time-budget contract cases passed.`);
  process.exit(0);
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
