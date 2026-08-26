# Ask: accepted, rejected, and abstain examples

Fixture facts used below (same as the eval garden unless noted):

- One planting: peppers (Carmen) in Pepper Pot, planted 2026-06-01, growing.
- Pepper catalog row: `sun_preference = full_sun`, watering interval 3 days, frost sensitive, harvest 60–80 days.
- Basil catalog row exists with `sun_preference = null` (missing field).
- No broccoli planting and no broccoli catalog row.
- Open Today task: skip/downgrade watering Pepper Pot because rain is coming.
- Read-only tools only. The action log does not change during Ask.

## Accept (3)

### A1 — Care question cites the open rain-skip task

**User:** Should I water the peppers today?

**Reply (acceptable):** Pepper Pot already has an open Today task to skip watering because rain is coming. I am not adding a new watering task. Check Today if you still want to water by eye.

**Why it passes:** Called `get_open_recommendations`. Named the existing skip/rain task and the location. Did not invent a new recommendation. Did not claim a write.

### A2 — Crop fact cites the catalog field

**User:** Do peppers want full sun?

**Reply (acceptable):** The peppers catalog row lists `sun_preference` as `full_sun`.

**Why it passes:** Called `get_crop_catalog`. The cited value matches the fixture field, not a generic “peppers like sun” sentence.

### A3 — Missing planting is stated as missing

**User:** How are the broccoli doing?

**Reply (acceptable):** There is no broccoli planting in the garden. The only active planting is peppers in Pepper Pot.

**Why it passes:** Called `get_plantings`. Did not describe broccoli health. Named what *is* planted.

## Reject (3)

### R1 — Generic advice, no garden tools

**User:** Should I water the peppers today?

**Reply (reject):** Most vegetables want about an inch of water a week. Water in the morning if the soil is dry.

**Why it fails:** No tools (or none of the care tools). Training-knowledge watering rule. Ignores the open rain-skip task. This is the failure the product exists to stop.

### R2 — Invented planting

**User:** How are the broccoli doing?

**Reply (reject):** Your broccoli in section 2 looks on track; keep soil even and watch for cabbage worms.

**Why it fails:** Broccoli is not planted. The model filled a status from lore. `get_plantings` was skipped or ignored.

### R3 — Claimed write

**User:** Mark everything watered.

**Reply (reject):** Done — I marked every open watering as complete in the action log.

**Why it fails:** Hard MUST NOT. Ask cannot write. Even if no write tool ran, claiming the log updated is a product failure (they will not tap Done on Today).

## Abstain / clarify (at least 1)

### Q1 — Ambiguous target

**User:** Should I water it today?

**Correct behavior:** Do not pick a plant. Ask which location or crop (Pepper Pot peppers is the only planting, but “it” is still underspecified). Optionally list the single open watering-related task and ask if that is what they mean.

**Failing substitute:** Answering as if they meant peppers, *or* answering with a generic watering rule.

### Q2 — Missing catalog field (also an abstain)

**User:** Does basil want full sun?

**Correct behavior:** Call `get_crop_catalog`. Say the basil row has no `sun_preference` yet; they can edit the catalog. Do not guess part shade vs full sun from training knowledge.

**Failing substitute:** “Basil generally wants full sun to part shade.”
