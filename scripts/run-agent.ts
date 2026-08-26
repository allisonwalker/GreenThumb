import { runAgent } from "../lib/agent";
import { resolveLlmProvider } from "../lib/llm";

async function main() {
  const prompt = process.argv.slice(2).join(" ").trim();
  const provider = resolveLlmProvider();

  console.log(`Running Jory Journal agent via LLM_PROVIDER=${provider}`);
  console.log("---");

  const result = await runAgent({
    kind: "script",
    trigger: "scripts/run-agent.ts",
    prompt:
      prompt ||
      "Inspect the garden with your tools. Summarize locations, plantings, recent care, weather, notes, and any open recommendations.",
  });

  console.log(`agent_run_id: ${result.agentRunId}`);
  console.log(`provider: ${result.provider}`);
  console.log(`model: ${result.model}`);
  console.log(`status: ${result.status}`);
  console.log(`stop_reason: ${result.stopReason}`);
  console.log(`iterations: ${result.iterations}`);
  console.log(
    `tokens: in=${result.inputTokens} out=${result.outputTokens} est_cost_usd=${result.estimatedCostUsd}`,
  );
  console.log("--- tool trace ---");
  for (const entry of result.toolTrace) {
    console.log(
      `#${entry.iteration} ${entry.name} (${entry.durationMs}ms)` +
        (entry.error ? ` ERROR: ${entry.error}` : ""),
    );
    console.log(`  input: ${JSON.stringify(entry.input)}`);
    if (entry.output !== undefined) {
      console.log(`  output: ${truncate(JSON.stringify(entry.output), 500)}`);
    }
  }
  console.log("--- model output ---");
  console.log(result.finalText || "(empty)");
  if (result.error) {
    console.log("--- error ---");
    console.log(result.error);
    process.exitCode = 1;
  }
}

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
