# Project Brief: GreenThumb

## One-liner

An agentic web app that holds persistent context on one household's garden — bed sections, pots, sun exposure, what's planted, and what care was done when — and proactively tells Allison and her husband what needs watering, fertilizing, pruning, and harvesting.

## Problem

Allison and her husband grow a home garden with no system for tracking what each planting needs or when. Every care decision depends on context that currently lives nowhere: when a crop went in the ground, how much sun that section gets, what the weather is about to do, and when it was last watered or fertilized.

Today they rely on memory and visual cues ("that looks thirsty"). Occasionally her husband asks Claude, but it starts from zero every time and has no knowledge of their specific garden — so it can only give generic advice. Memory and a general-purpose chatbot fail for the same underlying reason: neither one retains the garden's state.

Last season this produced three distinct failures, each on a different clock and at a different cost:

- **Wrong plant for the sun exposure.** Committed once in spring, irreversible, and not discovered for weeks. The most expensive failure, and the one most easily prevented — sun exposure per section is a static fact entered once.
- **Missed watering days.** High-frequency and recoverable right up until it isn't. Plants died.
- **Missed planting windows.** Calendar-driven and predictable far in advance. Plants went in late and never thrived.

## Target users

Two users — Allison and her husband — co-managing a single home garden. There is no third persona and no multi-household case.

Both need visibility into the same plant data and care schedule, either one should be able to log actions (watered, fertilized, pruned, harvested), and both should receive alerts. Neither is a specialist; the system must be usable without gardening expertise.

**The garden**, which sets the scale of everything:

- One raised bed, roughly 50′ × 3′, divided into **5–6 sections** that are re-cut each season depending on how they plant. Sections are user-defined at setup, not a fixed structure.
- **8 pots** scattered around the garden. Pots dry out far faster than the in-ground bed, so they run on a different watering cadence.
- **Every location is physically immovable** — the bed and the pots stay put. Sun exposure and soil are therefore stable facts, entered once at setup. What changes between seasons is *what gets planted* in each location, and how the bed is divided into sections.
- Total: **~13–14 growing locations**, small enough to reason about individually on a daily cadence.

## Goals & success criteria

**For the gardeners — what's true at the end of a successful season:**

- Every bed section produces a harvest, rather than half of them.
- Nothing dies of thirst.
- No planting is doomed from day one by being put in the wrong sun exposure.
- No planting window is missed.

**For the builder (capstone requirements):**

- The agent demonstrably adjusts a care recommendation in response to real live weather during a demo (e.g. skips watering because rain is coming).
- Both users can set up the garden profile and receive a relevant recommendation unaided.
- Clear demonstration of agentic behavior — proactive reasoning and autonomous tool use, not just prompt-and-response Q&A.

**Deliberately not addressed in v1:** getting the right *volume* of food — "not too much broccoli, not enough tomatoes." This is a real success indicator for Allison but is descoped (see Scope).

## Scope

**In scope (v1):**

- **Garden profile** — manual setup of bed sections, pots, soil type, sun exposure per location, hardiness zone, and current plantings. Sections are redefinable each season.
- **Care management (priority #1)** — per-location watering, fertilizing, and pruning schedule that adjusts to live conditions: skip watering after rain, flag frost risk, shift fertilizer cadence by growth stage, and treat pots as drying out faster than the bed.
- **Planting recommendations** — what to plant, in which section, and when, based on hardiness zone, per-section sun exposure, and layout.
- **Harvest timing** — predicted harvest window per planting, refined as planting dates and observed growth are logged.
- **Action log** — a simple record of what was done and when, feeding back into the agent's reasoning.
- **Agentic behavior** — proactive scheduled check-ins that pull weather and decide whether action is needed; on-demand Q&A over the same garden context; autonomous tool use against a weather API and a plant-care knowledge source.
- **Web app** accessible to both users from any device.
- **Notifications via push or email** for time-sensitive actions.

**Out of scope / later:**

- **Yield and volume planning** — how many of each crop to plant to match household consumption. Descoped for MVP: it needs a new input (consumption preferences), it's an annual calculation rather than live reasoning, and it therefore does least for the course's agentic requirement.
- **SMS / text alerts** — dropped; push or email is sufficient, which removes the only paid third-party dependency.
- Physical sensors (soil moisture or temperature probes). Conditions come from a weather API plus manually entered garden data.
- Computer vision or plant identification from photos.
- E-commerce, seed ordering, marketplace.
- Community, social, or multi-household features.

## Constraints & assumptions

- **Hard deadline: one month** — capstone due approximately **September 3, 2026**. This is the binding constraint on the project; it matters more than cost or stack.
- **No course-imposed stack requirements.** Framework, hosting, and model provider are all free choices, so they should be picked for speed of delivery within the free-tier budget.
- **Cost must be near zero.** Free tiers only for hosting, weather data, and LLM usage. This drove the SMS decision and should shape every dependency choice.
- **Notifications:** push or email. No paid SMS provider.
- **Platform:** web app, usable from phone and desktop.
- **Scale:** ~13–14 growing locations, 2 users, 1 garden. No multi-tenancy needed.
- **Conditions data:** weather API keyed to zip code or coordinates, plus manually entered garden details.
- **Assumption:** generic plant-care guidance is good enough to beat memory, even though it can't account for this specific yard's microclimate without sensors.
- **Context:** this is an AI capstone project, so visible agentic behavior is a hard requirement, not a nice-to-have.

**Decided: plant-care knowledge comes from the LLM's general knowledge**, not a curated reference dataset. Watering and fertilizing norms, pruning guidance, and days-to-harvest are all reasoned from the model rather than looked up. This keeps cost at zero and removes a data-sourcing step, at the price of unverifiable accuracy — the model can be confidently wrong about a specific crop, and there's no dataset to correct it against. Acceptable for v1 given that the bar is beating memory, but it means the app should not present plant-care facts as authoritative.

## What already exists

**Greenfield.** No code, no dependencies, no `docs/` directory prior to this brief. The repository contains only the original spec (`greenthumb-spec.md`) and the skill pipeline in `.cursor/skills/`.

Current "system" being replaced: memory, visual inspection of plants, and occasional ad-hoc questions to Claude that lack any garden context.

## Open questions

**Needed from Allison:**

- **Truncated success metric.** Line 47 of `greenthumb-spec.md` reads "without asce" — presumed "without assistance," but unconfirmed.

**For the architect:**

- **Tracking unit:** the original spec assumes per-plant tracking throughout. The real garden is section-and-pot based. Locations are permanent and their sun exposure and soil are fixed; plantings come and go, and the bed's section boundaries are re-cut each season. The data model should follow that split rather than the spec's per-plant assumption.
- **Section boundaries vs. sun exposure:** the bed itself never moves, but sun exposure varies along its 50 feet and the section divisions change between seasons. So a section's sun exposure follows from where it sits in the bed. Whether to capture exposure per position or re-enter it per section each season is an open design call.
- **Knowledge-source accuracy:** since plant-care guidance is LLM-generated (see Constraints), there's no ground truth to validate against. Worth deciding how the app signals uncertainty to the users.
- **Known v1 limitation:** without sensors, recommendations can't account for this specific yard's microclimate. Worth stating plainly to the users rather than implying precision the system doesn't have.

**For the PO — unresolved priority tension:**

The original spec ranks care reminders as primary and planting recommendations as secondary. But two of the three failures from last season (wrong sun exposure, missed planting windows) are planting-time decisions, and they carry the highest cost and longest feedback loop. Watering is the most *frequent* failure; planting is the most *expensive* one. This ordering has not been resolved and should be decided consciously.

**For the PO — the one-month deadline makes the in-scope list a ranking problem:**

Everything in scope is genuinely wanted, but a month almost certainly won't fit all of it. Two observations to weigh when sequencing:

- **The demo lands in early September**, near the end of the growing season. That favors features that can show real behavior against real data at that moment — weather-adjusted watering, and harvest timing for what's already in the ground. Planting recommendations are hardest to demonstrate compellingly in September, since the main planting windows have passed, even though they address Allison's most expensive failures.
- **Two-user access is a scope lever.** Full multi-user authentication is meaningful work for a two-person household. A single shared household login would satisfy "both can see the same data and either can log an action" for a fraction of the effort, at the cost of not knowing who did what.

**Documentation cleanup:**

`greenthumb-spec.md` contains garbled text at lines 15, 21, 31, 37, and 47 (e.g. "soil motemperature probes", "log actions (red, pruned, harvested)", "an LLM-based age", "st data via a weather API"). This brief supersedes it; the spec should be corrected or retired.
