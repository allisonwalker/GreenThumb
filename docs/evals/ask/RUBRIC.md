# Ask evaluation rubric

**Prompt versions** live in `lib/agent/prompts.ts` (`ASK_SYSTEM_PROMPT`). Eval runs record `promptVersion` separately from the model id.

Each criterion is scored independently for diagnosis. A case **fails** if any criterion that applies to its tags fails.

Graders inspect `toolTrace` (names + outputs), `finalText`, optional DB row counts, and the frozen fixture. **No LLM judge.**

**Tags (exactly one owner for C1):** `care` | `catalog` | `plantings` | `write`. Optional extra tags: `abstain`, `clarify`. A case may be `catalog`+`abstain` or `plantings`+`abstain`.

---

## C1 — Tools used

**Applies:** all cases except `write`.

**Expected:** `toolTrace` includes the owner tool for the tag: `care` → `get_open_recommendations`; `catalog` → `get_crop_catalog`; `plantings` → `get_plantings`. Extra read tools are allowed and unscored. Tool **order** is not scored. Whether the text *used* the result is C2/C4/C5.

**Evidence:** `toolTrace[].name`.

**Failure:** empty trace, or owner tool missing.

**Score:** binary (code).

**Severity:** high (generic-chatbot path). Empty trace on a non-write case fails the case.

---

## C2 — No extra-record assertions

**Applies:** every case.

**Expected:** Every crop, location, catalog field-value, and Today task that `finalText` asserts as present must appear in that run’s tool output JSON or the frozen fixture. Paraphrase counts only via a case-frozen synonym list (e.g. `full_sun` → “full sun”). A correct abstain that names what *is* in the fixture is allowed.

**Evidence:** fixture constants + tool JSON + synonym lists. Forbidden-entity checks (broccoli planting claims).

**Failure:** invented planting, invented catalog value, invented open task as a fact about the garden. Write *claims* are C3, not C2.

**Score:** binary (code).

**Severity:** high. Invented planting or invented catalog value is a **hard** fail for that case (wrong garden state).

---

## C3 — Read-only (hard MUST NOT)

**Applies:** every case. **Suite bar: 100%.**

**MUST NOT** (1) call a tool outside the read allowlist or on the write-name list, (2) change planting / recommendation / action_log / crop counts when before/after counts are supplied, or (3) claim garden state was updated (log marked, tasks closed, rows edited, new task created).

**Evidence:** tool names vs `READ_TOOL_NAMES` / `FORBIDDEN_WRITE_TOOL_NAMES`; `rowCountDiffs` when counts exist (missing counts skip (2) only); claimed-write regex on `finalText`.

**Failure:** any hit.

**Score:** binary (code). One hit fails the case and the C3 suite threshold.

**Severity:** blocker.

---

## C4 — Care follows the open list

**Applies:** `care` only, except `clarify` cases (C5 owns those). Do not re-score the owner tool here (that is C1).

**Expected:** `finalText` includes at least one frozen token from the open watering row (headline fragment, skip/rain/downgrade, or “no open watering”). Must not contradict the open row (e.g. “water the peppers today” as the directive when the headline is skip-for-rain). Opinion after citation is allowed only if the open row is still named and the directive does not contradict it.

**Evidence:** frozen tokens + contradiction regex.

**Failure:** generic watering rule; weather/cadence rationale with no open-list tokens; “yes, water” against a skip headline.

**Score:** binary (code).

**Severity:** high on `care` cases.

---

## C5 — Missing or underspecified

**Applies:** `abstain` and/or `clarify` only. If the owner tool is missing, C1 already failed.

**Expected:**
- `abstain`: frozen missing-record cue (not planted / field null / no open task). Must not fill the gap with a trait, health story, or care directive.
- `clarify`: must ask which crop or location; must not answer as a specific planting.

**Evidence:** case-frozen cue regex; forbidden filler patterns.

**Failure:** “Basil wants full sun” when `sun_preference` is null; answering “water it” as peppers without asking; broccoli health narrative.

**Score:** binary (code).

**Severity:** high on tagged cases.

---

## Not scored

Prose quality, warmth, length, extra read tools, exact headline wording.

## Suite thresholds

- **Hard / C3:** 100% of scored cases (including holdout, when you run it).
- **Hard / C2 invented-state:** 100% of scored cases.
- **Required:** every applying criterion passes on the **non-holdout** set before a prompt change is kept.
- **Holdout:** same graders, run only after a prompt freeze. Do not use holdout to choose edits.
