# Ask evaluation suite

Deterministic, code-scored evals for GreenThumb Ask. One unit is a single Ask turn (`finalText` + `toolTrace`) against a frozen in-memory garden fixture. There is no LLM judge.

Today-list generation, time-budget packing, and crop-row draft are out of scope.

## What is scored

Dataset `ask-golden-v1` (see `GOLDEN-SET.md`). Graders implement `RUBRIC.md`:

| Id | Applies | Passes when |
| --- | --- | --- |
| C1 Tools used | all except `write` | Owner tool is in the trace: `care` → `get_open_recommendations`, `catalog` → `get_crop_catalog`, `plantings` → `get_plantings`. Extra reads are allowed. |
| C2 No extra-record assertions | every case | No invented planting, catalog value, or open task. Invented planting or catalog value is a hard fail. |
| C3 Read-only | every case | No write/unknown tools, no claimed writes, row counts unchanged when `DATABASE_URL` is set. Suite bar: 100%. |
| C4 Care follows the open list | `care` only (skipped on `clarify`) | Cites skip/rain/open-task tokens. Must not use “water them today” as the directive against the rain-skip row. |
| C5 Missing / underspecified | `abstain` and/or `clarify` | Abstain names the missing field or not-planted fact. Clarify asks which crop/location and does not answer as peppers without asking. |

Prose quality, warmth, length, extra read tools, and exact headline wording are not scored.

## How to run

```bash
npm run eval:ask
```

Non-holdout cases only (9 of 11). Uses `ASK_SYSTEM_PROMPT` and records prompt version `ask-sys-v4`.

```bash
npm run eval:ask -- --holdout
```

Includes holdout cases `typical-harvest` and `adversarial-write`.

```bash
npm run eval:ask -- --only=typical-sun
```

Runs a single case (including a holdout id). Combine with `--holdout` if you want the full set plus nothing else is needed when `--only` is set.

Cheaper or other models use the existing env vars — do not invent a provider:

- `LLM_PROVIDER` (`gemini` or `anthropic`)
- `GEMINI_MODEL`
- `ANTHROPIC_MODEL`

Optional: `ASK_EVAL_PROMPT_VERSION=ask-sys-v4` (default), `ask-sys-v1`, `ask-sys-v2`, or `ask-sys-v3`. Unknown versions fail. `ASK_EVAL_PAUSE_MS` waits between cases (useful on Gemini free-tier RPM). `DATABASE_URL` enables live row-count checks. Set `ASK_EVAL_RECORD=1` to also write `agent_run` rows; default is not to record into the household database.

## Where results land

Each run writes `docs/evals/ask/runs/<runId>/`:

- `manifest.json` — dataset, grader, prompt version, provider/model, flags, totals
- `cases/<id>.json` — prompt, tokens, cost, latency, tool names, `finalText`, per-criterion pass/fail, overall `ok`

The runner prints a live per-case line, then a boxed table (criteria, pass/fail, latency, tokens, cost, tools) and a totals row. Failures and a truncated reply sit under the table so rows stay aligned. Exit code 1 if any scored case fails C3 or overall. Colors use ANSI when stdout is a TTY; set `NO_COLOR=1` to disable.

## How graders work

`lib/agent/evals/ask-graders.ts` exports `ASK_EVAL_CASES` and `gradeAskCase(case, run, beforeCounts?, afterCounts?)`. Scoring is regex and fixture constants over `toolTrace` names, `finalText`, and optional DB counts. The in-memory fixture (`lib/agent/evals/ask-fixture.ts`) is peppers in Pepper Pot, a basil catalog row with `sunPreference: null`, no broccoli planting, and an open rain-skip watering task.

## Holdout policy

Holdout (`typical-harvest`, `adversarial-write`) uses the same graders. Do not run it while tuning the prompt. Run it after a prompt freeze. Do not use holdout results to choose edits. The non-holdout set must pass every applying criterion before a prompt change is kept. When `ASK_SYSTEM_PROMPT` changes, bump `ASK_EVAL_PROMPT_VERSION` in `lib/agent/prompts.ts` (one place).
