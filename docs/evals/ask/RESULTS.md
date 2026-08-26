# Ask eval run log

Dataset `ask-golden-v1`. Grader `ask-deterministic-v1`. Non-holdout = 9 cases. Model unless noted: `claude-sonnet-4-6` via `LLM_PROVIDER=anthropic`. Holdout not used for these decisions.

## Baseline — `ask-sys-v1`

Run `docs/evals/ask/runs/2026-08-20T02-29-11-579Z`.

| | |
| --- | --- |
| passed | 7 / 9 (8 / 9 after C2 grader fix on basil) |
| C3 fails | 0 |
| tokens | 29789 in / 2065 out |
| est. cost | $0.080 |
| latency | 61.1s |

Live failures:

- `edge-basil-sun` C2 — false positive on “your basil variety”; reply correctly abstained. Grader tightened; this case is a pass on the saved text.
- `clarify-it` C5 — named Pepper Pot peppers and skipped watering without asking which plant.

## One-change experiments

**v2** (new bullet: ask which plant for unnamed “it”, before answering). Run `2026-08-20T02-31-41-436Z`. 8/9. `clarify-it` gained C5 but dropped C1 (no tools). Reference passes held. **Not kept** — empty-trace answers fail C1.

**v3** (same new bullet, “still call tools, then ask”). Run `2026-08-20T02-33-08-378Z`. 8/9. `clarify-it` used tools (C1) but assumed the only planting (C5). **Not kept**.

**Shipped prompt remains `ask-sys-v1`.** Clarify stays an open miss.

## Cost pass

Run `docs/evals/ask/runs/2026-08-20T02-34-21-386Z` — `LLM_PROVIDER=gemini` (`gemini-3.7-flash` on this key), `ask-sys-v1`.

The first three typical cases **passed** (water-skip, sun, interval). The remaining six hit Gemini **free-tier RPM** (5 `generate_content` requests / minute). Quota errors produced empty replies; those must not count as Flash quality.

**Keep Sonnet** as the Ask eval / demo configuration. Flash is cheaper when it completes (~$0.001 vs ~$0.08 for nine Sonnet cases) but cannot finish this suite on the free tier. Do not route production Ask to Flash until a paid quota can run the full non-holdout set.

## Holdout (after freeze, not used to choose the prompt)

`typical-harvest` PASS (`2026-08-20T02-35-20-685Z`). `adversarial-write` PASS (`2026-08-20T02-35-30-231Z`). Same model and `ask-sys-v1`.

## Decision

Ship **`ask-sys-v1`** on Anthropic Sonnet. Keep v2/v3 as recorded experiments. Add cases over time; do not tune on holdout.
