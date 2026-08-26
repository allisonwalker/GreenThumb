# Project Brief: GreenThumb

## One-liner

A household garden app that remembers one bed and its pots, computes a daily care list from stored crop needs plus weather and the care log, and uses an LLM when Allison or her husband want to talk through that list — especially how to spend a limited number of hours.

## Problem

Allison and her husband grow a home garden with no system for tracking what each planting needs or when. Every care decision depends on context that currently lives nowhere: when a crop went in the ground, how much sun that section gets, what the weather is about to do, and when it was last watered or fertilized.

Today they rely on memory and visual cues ("that looks thirsty"). Occasionally her husband asks Claude, but it starts from zero every time and has no knowledge of their specific garden — so it can only give generic advice. Memory and a general-purpose chatbot fail for the same underlying reason: neither one retains the garden's state.

Last season this produced three distinct failures, each on a different clock and at a different cost:

- **Wrong plant for the sun exposure.** Committed once in spring, irreversible, and not discovered for weeks. The most expensive failure, and the one most easily prevented — sun exposure per section is a static fact entered once.
- **Missed watering days.** High-frequency and recoverable right up until it isn't. Plants died.
- **Missed planting windows.** Calendar-driven and predictable far in advance. Plants went in late and never thrived.

A fourth, day-to-day problem sits on top of those: when time is tight, the question is not "what does the garden need?" but "I have two hours Saturday and two hours Sunday — what should I definitely do, and what can wait?" A long undifferentiated list does not answer that.

**What this is not:** daily watering / harvest / planting advice does not need a fresh LLM judgment every morning. Those questions are matching: stored crop needs, crossed with rain and the care log. Using a model for that is expensive, non-deterministic, and hard to check. The model earns its keep on conversation — general garden Q&A over this garden's context, and cutting an already-computed list to the hours they have.

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
- On a short weekend, they spend the hours they have on the work that most needs doing, instead of guessing.

**For the builder (capstone requirements) — the demo must show both:**

- The daily care list **skips or downgrades watering because rain is coming** (or the reverse on a dry stretch). This is the matching engine against live weather, not an LLM soliloquy.
- Given a stated time budget (e.g. two hours Saturday and two hours Sunday), the agent turns that same list into **must-do vs if-you-have-time**.
- Both users can set up the garden profile and receive a relevant recommendation unaided.
- Clear demonstration of agentic behavior on the conversational path — the model uses tools against this garden's context (open tasks, crop rows, weather, care log), not just prompt-and-response Q&A with no grounding.

**Deliberately not addressed in v1:** getting the right *volume* of food — "not too much broccoli, not enough tomatoes." This is a real success indicator for Allison but is descoped (see Scope).

## Scope

**In scope (v1):**

- **Garden profile** — manual setup of bed sections, pots, soil type, sun exposure per location, hardiness zone, and current plantings. Sections are redefinable each season.
- **Crop care catalog** — one shared, searchable care row per crop (not per planting). When a crop appears in the garden for the first time, the LLM drafts the row; Allison and her husband can view and edit it. Fields: watering cadence, fertilizing interval, pruning, frost sensitivity, sun preference, ideal planting window, harvest window / days-to-harvest, and time estimates per care action. Pot vs bed dryness stays on the location, not duplicated on the crop row.
- **Daily care list (matching, not a model)** — per-location watering, fertilizing, pruning, harvest, frost, and planting-window tasks computed by crossing crop rows with live weather and the care log. Skip watering after rain, flag frost risk for sensitive crops, treat pots as drying out faster than the bed. Copy on the list is templated from those same inputs ("Section 3 — water today: last watered 4 days ago, 0.1″ rain this week, tomatoes want water every 3 days") so the demo is a comparison you can point at, not a model judgment. This is the default thing they look at; they do not have to ask. No LLM is required to produce or phrase the list.
- **Time-budget conversation** — optional overlay when time is tight. The gardener states available hours; the agent does not invent work. It cuts the already-computed list into "definitely do X, Y, Z" and "try A, B, C if you have time." Hours are the constraint.
- **General garden Q&A** — still in scope, on top of the list and the time-budget flow. Answers may use the crop care row *and* this garden's state (what's planted where, weather, care log, open tasks). "Do peppers want full sun?" and "should I water the peppers today?" are both in bounds; a generic chatbot with no garden and no crop row is not.
- **Planting fit** — warn when a crop's stored sun preference does not match the section; surface ideal planting windows from the crop row.
- **Harvest timing** — predicted harvest window per planting from the crop row, refined by planting dates in the log.
- **Action log** — a simple record of what was done and when, feeding the matching engine and the conversational agent.
- **Web app** accessible to both users from any device.
- **Notifications via push or email** for time-sensitive items on the daily list.

**Out of scope / later:**

- **Using the LLM as the daily care engine** — no model pass to decide *or write* the Today list. Matching plus templates is enough, and it's the more demoable path: "skipped watering because 0.3″ of rain is coming" is a checkable comparison. That LLM path was the previous design and is explicitly retired.
- **A trained ML model** for care. "Simpler than an LLM" here means stored needs plus matching, not a fitted model.
- **Yield and volume planning** — how many of each crop to plant to match household consumption. Descoped for MVP: it needs a new input (consumption preferences) and it's an annual calculation rather than live matching or conversation.
- **SMS / text alerts** — dropped; push or email is sufficient, which removes the only paid third-party dependency.
- Physical sensors (soil moisture or temperature probes). Conditions come from a weather API plus manually entered garden data.
- Computer vision or plant identification from photos.
- E-commerce, seed ordering, marketplace.
- Community, social, or multi-household features.
- A full plant encyclopedia. The catalog only holds crops that are in (or being added to) this garden; one row per crop, not a curated reference dataset.

## Constraints & assumptions

- **Hard deadline: one month** — capstone due approximately **September 3, 2026**. This is the binding constraint on the project; it matters more than cost or stack.
- **No course-imposed stack requirements.** Framework, hosting, and model provider are all free choices, so they should be picked for speed of delivery within the free-tier budget.
- **Cost must be near zero.** Free tiers only for hosting, weather data, and LLM usage. Daily list computation should not require a multi-step model loop. LLM spend is for (1) drafting a crop row when a new crop is added, (2) time-budget conversation, (3) general Q&A.
- **Notifications:** push or email. No paid SMS provider.
- **Platform:** web app, usable from phone and desktop.
- **Scale:** ~13–14 growing locations, 2 users, 1 garden. No multi-tenancy needed.
- **Conditions data:** weather API keyed to zip code or coordinates, plus manually entered garden details.
- **Assumption:** a generated-then-edited crop row is good enough to beat memory. The model can still be wrong at draft time; the correction path is editing the row, not hoping tomorrow's prompt is better.
- **Context:** this is an AI capstone project. Visible agentic behavior is still a hard requirement — it now lives on the conversational path (tools over garden state for Q&A and time-budgeting), plus one-shot crop-row generation. The weather-adjusted daily list is a graded product demo, but it is not itself the LLM.

**Decided: plant-care knowledge is a per-crop lookup row, not on-the-fly LLM reasoning.** The model drafts the row when a crop is first added; users search, view, and edit it; every tomato planting shares the same tomato row. Daily recommendations read that row. Growth stage (seedling vs fruiting) may be a thin rule on top of the row, not a reason to regenerate care from scratch each day.

## What already exists

This is **not greenfield.** A Next.js app is deployed, with Supabase auth (magic link + two-address allowlist), a garden profile (location, sun map, seasonal bed sections, pots), weather caching, an agent engine with tools, and a Today page that shows open recommendations. Deterministic care-signal logic (rain, ET₀, last watered, pots vs bed) is already in progress in code, while several Linear stories and `docs/architecture.md` still describe the LLM as the daily care engine.

Still placeholder or not yet built: the action log UI, Ask / Q&A, crop care catalog, time-budget conversation, scheduled check-in / digest, and harvest / planting-window surfaces.

Current "system" being replaced: memory, visual inspection of plants, and occasional ad-hoc questions to Claude that lack any garden context.

## Open questions

**Needed from Allison:**

- **Truncated success metric.** Line 47 of `greenthumb-spec.md` reads "without asce" — presumed "without assistance," but unconfirmed.

**For the architect:**

- **Crop catalog vs planting:** one row per crop, shared across plantings. When the first planting of a crop is recorded, generate the row; later plantings of the same crop reuse it. How that joins to locations, seasons, and the matching engine is a design call.
- **Daily check-in without an LLM loop.** The scheduled job should compute and persist the care list from crop rows + weather + care log. The previous architecture (agent loop, `propose_recommendation` as the only write, facts-vs-inferences because knowledge was unverifiable) is now the wrong shape for that path. Conversation still needs an agent with tools.
- **Time estimates** live on the crop row and are what make a two-hour plan honest. Defaults at generation time; users edit.
- **Section boundaries vs. sun exposure:** the bed itself never moves, but sun exposure varies along its 50 feet and the section divisions change between seasons. Capture exposure per position; derive it per section. (Prior brief left this open; the data model already follows position-based sun.)
- **Known v1 limitation:** without sensors, recommendations can't account for this specific yard's microclimate. Worth stating plainly. Partial correction path is now editing the crop row (and existing garden notes), not only prompting.
- **`docs/architecture.md` is stale** relative to this brief. It still treats the LLM as the care engine and plant-care knowledge as unverifiable model inference. It needs a pass against this split.

**For the PO — existing stories that are now mis-framed:**

The original spec ranked care reminders as primary and planting as secondary. That still holds for the *daily list*. What changed is *how* care, harvest, and planting advice are produced (matching against crop rows, not an LLM), and *what* the LLM is for (draft crop rows; time-budget the list; general Q&A).

Stories written as "the agent reasons watering / harvest / planting" need a rewrite, not just a smaller prompt: especially ALL-8 (Today / weather-adjusted care), ALL-9 (daily check-in), ALL-10 (Ask), ALL-12 (harvest), ALL-18 (one agent engine for everything), ALL-21 / ALL-36 / ALL-37 (uncertainty contract for unverifiable LLM knowledge), ALL-39 (planting suggestions). New backlog items are needed for the crop catalog and the time-budget conversation.

**For the PO — the one-month deadline still makes the in-scope list a ranking problem:**

- **The demo lands in early September**, near the end of the growing season. Weather-adjusted watering and harvest timing still demo well against what's in the ground. Time-budget conversation demos well regardless of season. Planting-window suggestions remain hardest to demonstrate compellingly in September.
- **Two-user access is already in motion** (individual magic-link accounts). Not a lever to reopen.

**Documentation cleanup:**

`greenthumb-spec.md` contains garbled text and still describes an LLM-based daily care agent. This brief supersedes it.

## Increment: app shell and Garden (Aug 2026)

Product name shown to people is **Jory Journal**. Today stays the app home. Catalog, Log, and Ask stay in the shell. Matching and auth stay untouched.

**In this increment:**

- Chrome always shows Jory Journal and this garden’s name. Same five destinations (Today, Garden, Catalog, Log, Ask) plus sign out. Bottom nav on phone, side on desktop. Not a sixth tab.
- `/garden` is a locations dashboard only: bed sections, then pots; each row has a name and planting summary and opens that location. No spatial bed map. No LLM on Garden.
- Profile, sun map, and season drawing move to `/garden/setup`, linked from the Garden header.
- Empty Garden (no sections/pots) sends the gardener to setup.

**Out of this increment:** visual identity replacement; mixing setup forms into the location list; extra personas.

## Increment: bolder, then polish (Impeccable → PO → fullstack-dev)

Landing/sign-in already run through `bolder`. Signed-in screens still read flat. Full increment: `docs/polish-brief.md`.

**Phase A (bolder) first:** document the two current worlds; promote landing’s motif into shared tokens if Operate cannot express it yet; amplify Today / Garden / Catalog / Log / Ask one surface at a time; rewrite `DESIGN.md` to the **bold** incumbent. Do not polish the quiet look.

**Phase B (polish) second:** audit and finish states, a11y, and drift against that new `DESIGN.md`. Landing/sign-in get polish only (no second bolder).

**Out of this increment:** a third visual identity; expanding primitives inside a page ticket; matching/auth/agent behavior changes; dark mode; WCAG-as-a-project.
