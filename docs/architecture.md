# Architecture

## Overview

GreenThumb is a web app that holds persistent state for a single household garden — one 50′ × 3′ raised bed divided into seasonal sections, plus 8 permanent pots — and uses an LLM agent to turn that state plus live weather into specific care recommendations. It serves exactly two users (Allison and her husband) managing exactly one garden.

The system replaces memory. Its value comes entirely from retaining garden context that a general-purpose chatbot cannot: what is planted where, how much sun each spot gets, what care was done when, and what the weather has done and is about to do.

Design horizon is deliberately short: a one-month build to a working demo around **September 3, 2026**, on free or near-free infrastructure, for 2 users and ~14 growing locations. Nothing here is built for scale that does not exist.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | One repo for UI and server, streaming responses, zero-config deploys. Boring and fast. |
| Hosting | Vercel Hobby | Free, push-to-deploy. Functions allow up to 300s, which comfortably fits an agent loop. |
| Database | Supabase Postgres (free) | Relational fits the location/planting/action model. 500 MB is ~1000× what this needs. |
| Auth | Supabase Auth, email magic link | No passwords to store or handle. Two real accounts, so the action log can attribute who did what. |
| ORM / migrations | Drizzle | Typed schema, plain SQL migrations, light in serverless. |
| UI | Tailwind + shadcn/ui | Mobile-first component set without design work. |
| LLM | Anthropic Claude (Sonnet for the daily run, Haiku for Q&A) | Allison has existing credits. Strong tool-use support. Accessed through a provider seam (see below). |
| Weather | Open-Meteo | Free, **no API key**, 16-day forecast plus `past_days` history, and reference evapotranspiration (ET₀) — a direct measure of how fast soil is drying. |
| Email | Nodemailer over Gmail SMTP (app password) | Free, reaches both users with no domain or DNS setup. |
| Scheduler | GitHub Actions cron | Free, flexible cadence, timezone-controllable, and every run leaves a log. Vercel Hobby cron is once-per-day, UTC-only, and fires anywhere within the scheduled hour. |

Two notes on the stack that matter more than they look:

**The LLM sits behind a provider seam.** All model calls go through one module (`lib/llm/`) exposing a single `runToolLoop()` interface. Anthropic is the implementation; Google Gemini's free Flash tier (1,500 requests/day, no credit card) is the documented fallback. This is one small file's worth of indirection that buys an escape hatch if credits run out mid-build — the one dependency here that is *not* actually free.

**Open-Meteo requires attribution** under its CC BY 4.0 data licence. A footer credit satisfies this. Non-commercial use is free up to 10,000 calls/day; this app will make roughly 1–2.

## System diagram

```mermaid
flowchart TB
    subgraph Users
        A[Allison]
        H[Husband]
    end

    subgraph Vercel["Vercel (Next.js)"]
        UI[Web UI<br/>Today · Garden · Log · Ask]
        API[Route handlers]
        AGENT[Agent engine<br/>lib/agent — framework-free]
        TOOLS[Tool layer<br/>read-only + propose]
    end

    subgraph External
        LLM[Anthropic Claude]
        WX[Open-Meteo<br/>no API key]
        SMTP[Gmail SMTP]
    end

    subgraph Supabase
        DB[(Postgres)]
        AUTH[Auth · magic link]
    end

    GHA[GitHub Actions<br/>daily cron + weekly backup]

    A & H --> UI
    UI --> API
    API --> AUTH
    API --> AGENT
    GHA -->|POST /api/agent/checkin<br/>bearer CRON_SECRET| API
    AGENT --> TOOLS
    AGENT <-->|tool-use loop| LLM
    TOOLS --> DB
    TOOLS --> WX
    AGENT -->|recommendations| DB
    API -->|alert email| SMTP
    SMTP --> A & H
    GHA -->|pg_dump artifact| DB
```

The important structural property: **the agent engine is a plain TypeScript module with no framework dependency.** It is called from a Next route handler (for Q&A) and from a Node script (for the scheduled run). That keeps the scheduled job free of serverless timeout risk if it ever outgrows 300s, and it means the agent can be exercised from a test script without booting a web server.

## Folder structure

```
app/
  (auth)/                 magic-link sign-in
  today/                  open recommendations — the primary screen
  garden/                 locations, sun zones, seasons, plantings
  log/                    action log entry + history
  ask/                    Q&A chat (streamed)
  api/
    agent/checkin/        scheduled run entrypoint (secret-gated)
    agent/ask/            streaming Q&A
    recommendations/      done / dismiss
    log/                  create action log entries
lib/
  agent/                  the engine: loop, prompts, run recording
    tools/                one file per tool, each a plain async function
  llm/                    provider seam (anthropic.ts, gemini.ts)
  weather/                Open-Meteo client + cache + normalization
  notify/                 email composition and send with dedupe
  db/                     Drizzle schema, migrations, queries
  garden/                 sun-exposure derivation, day-boundary helpers
scripts/
  checkin.ts              scheduled run, invoked by GitHub Actions
  seed.ts                 seeds the real garden: bed, sun zones, 8 pots
.github/workflows/
  checkin.yml             daily cron
  backup.yml              weekly pg_dump
```

## Data model

### The central modeling decision: position owns sun exposure

The brief raised this as an open question, and it is the one modeling call that shapes everything else. The bed never moves, but sun exposure varies along its 50 feet, and the section boundaries are re-cut every season.

**Resolution: sun exposure is a property of *position along the bed*, entered once and permanent. Sections are seasonal intervals over that fixed strip, and their exposure is derived from the positions they cover.**

```
Bed, 0 ft ─────────────────────────────────────────────── 50 ft
sun_zone:  [0–18 full_sun] [18–34 part_sun] [34–50 part_shade]   ← permanent, entered once
                                                                    
2026 sections: [Sec 1: 0–10][Sec 2: 10–22][Sec 3: 22–34][Sec 4: 34–50]
                  full_sun    mixed¹        part_sun       part_shade
2027 sections: [A: 0–16][B: 16–30][C: 30–40][D: 40–50]           ← re-cut, exposure re-derived
                full_sun   mixed²    part_shade  part_shade         with zero re-entry

¹ 8 ft full_sun + 4 ft part_sun → surfaced as "mostly full sun"
² 14 ft part_sun + ... etc.
```

The alternative — asking the user to re-enter sun exposure per section each season — was rejected. It re-collects a fact that has not changed, and it invites drift where two sections covering the same ground disagree. Deriving it also means that when reality *does* change (a tree comes down, a fence goes up), you edit one sun zone and every section's exposure updates.

Derived exposure is **cached on the section row with an `override` escape hatch**, so the agent and UI read one column, and the user can correct the derivation without fighting it.

### Entities

**Permanent layer** — physical facts, entered once at setup:

- `garden` — singleton. Coordinates, timezone, hardiness zone, optional frost dates.
- `bed` — dimensions (50 × 3), soil type.
- `sun_zone` — `(bed_id, start_ft, end_ft, sun_exposure)`. Non-overlapping, covering 0→50. **The durable source of truth for sun.**
- `pot` fields live on `location` (below) — pots are permanent *and* are directly plantable, so they need no seasonal wrapper.

**Seasonal layer** — what changes:

- `season` — name, date range, `is_current`.
- `location` — the unit of planting and care, with a `kind` discriminator:
  - `kind = 'bed_section'`: `bed_id`, `start_ft`, `end_ft`, `season_id`. Exposure and soil **derived** from the bed and its sun zones.
  - `kind = 'pot'`: `season_id IS NULL` (permanent). Own `sun_exposure`, `volume_gal`, `material`, `soil_type`.
  - Shared: `name`, `sun_exposure` (cached), `sun_exposure_source` (`derived` | `override`), `dryness_factor`, `notes`, `retired_at`.

A single `location` table with kind-dependent `CHECK` constraints was chosen over separate `pot` and `bed_section` tables. At ~14 rows the cost is a few nullable columns; the benefit is that `planting`, `action_log`, and `recommendation` all get one real foreign key instead of a polymorphic reference, and the agent's tools return one uniform list. A `current_location` view unions permanent pots with the current season's sections.

`dryness_factor` is where "pots dry out faster than the bed" lives as data rather than as a hardcoded rule — pot material and volume feed it, and the agent receives it as an input.

**Activity layer:**

- `planting` — `location_id`, crop name + variety, method (seed/transplant), `planted_on`, `removed_on`, status, plus LLM-derived `harvest_window_start/end`, `harvest_confidence`, and `harvest_rationale` with the estimating model recorded.
- `action_log` — `location_id?`, `planting_id?`, `user_id`, `action_type` (watered / fertilized / pruned / harvested / planted / observed / treated), `occurred_at`, free-text detail. Append-only in spirit. **This is the memory replacement and the system's ground truth.**
- `garden_note` — free-text user observations and corrections, injected into agent context. The cheap way to correct the model without a dataset: "the far end floods", "our tomatoes always ripen late". See *Handling an unverifiable knowledge source*.

**Weather layer:**

- `weather_day` — normalized, one row per `(garden_id, date, kind)` where kind is `observed` or `forecast`: precipitation, min/max temp, ET₀, wind. Upserted.
- `weather_fetch` — audit: request URL, timestamp, raw JSON, success/error.

Weather is cached rather than fetched per request, for three reasons: repeat agent runs stay cheap and consistent, the app works if Open-Meteo is briefly down, and — most usefully — the exact forecast behind any past recommendation stays inspectable, which is what makes "it skipped watering because rain was coming" demonstrable after the fact rather than merely claimed.

**Agent layer:**

- `agent_run` — kind, trigger, status, timings, model, token counts, estimated cost, the full `tool_calls` trace, linked `weather_fetch_id`, and `simulated_weather` when in demo mode. This is the observability backbone; Supabase's free tier retains platform logs for only **1 day**, so run history must live in our own table.
- `recommendation` — first-class persisted record: `location_id`, `action_type`, `urgency` (now / today / this_week / monitor), `headline`, `rationale`, `confidence`, `evidence` (facts vs. inferences, separated), `status` (open / done / dismissed / superseded / expired), and `resolved_action_log_id` closing the loop when the user marks it done.
- `conversation` / `message` — Q&A history, each assistant message linked to its `agent_run`.
- `notification` — channel, recipient, the recommendations included, provider result, and a unique `dedupe_key` so a retried run cannot double-send.
- `app_user`, `allowed_email` — two users; signup gated to an explicit allowlist.

Recommendations are stored, not streamed-and-forgotten. That is what makes them alertable, dismissible, deduplicable across days, and auditable during the demo.

## External services

| Service | Purpose | Auth | Failure mode |
| --- | --- | --- | --- |
| Anthropic Claude | All agent reasoning | `ANTHROPIC_API_KEY` | Rate limit or credit exhaustion → run recorded as failed, no alert sent (see degradation) |
| Open-Meteo | Forecast + recent history + ET₀ | **None** | Cached data serves; run proceeds with staleness noted |
| Supabase | Postgres + Auth | Service role key (server-only) | Hard dependency. Pauses after 7 days inactivity — the daily cron prevents this |
| Gmail SMTP | Alert email | App password | Send failure logged; the in-app Today view remains the source of truth |
| GitHub Actions | Scheduling + backups | Repo secrets | Missed run is visible in Actions history |

Having no API key for weather is a small but real security win: the highest-frequency external call in the system carries no credential to leak.

## Auth & authz

Supabase Auth with **email magic links** — no passwords stored, hashed, or reset. Two real accounts rather than a shared household login, because the action log's whole job is answering "has this already been done, and by whom," and because with a hosted provider individual accounts cost roughly the same effort as a shared login done properly.

Authorization is deliberately trivial: **any authenticated user is a full member of the one garden.** There are no roles, no per-record ownership, and no sharing model, because there is one garden and two equal co-gardeners. Building a permission system here would be over-engineering for a household of two.

The real access control problem is therefore not *authorization* but *admission*: the app is on a public URL, and Supabase signup is open by default. Admission is gated by an explicit two-address allowlist checked server-side at sign-in.

Data access is **server-only**: the browser never talks to Postgres directly, and all queries run in route handlers behind an auth check using the service role key. Row Level Security is additionally enabled with deny-by-default policies as defense-in-depth, so that an accidentally leaked anon key grants nothing.

## Key data flows

### 1. Proactive daily check-in (the agentic core — ALL-8, ALL-9)

```
GitHub Actions (06:00 garden-local)
  └─ POST /api/agent/checkin  with bearer CRON_SECRET
      └─ create agent_run (kind=scheduled_checkin)
          └─ agent loop, bounded to N tool calls / token budget:
              get_garden_profile()      → zone, coords, timezone
              get_current_locations()   → 14 locations w/ sun + dryness_factor
              get_plantings()           → crop, planted_on, days since
              get_care_history(30d)     → last watered/fertilized per location
              get_weather(-7, +7)       → precip, temps, ET₀  [cached]
              get_garden_notes()        → user corrections
              get_open_recommendations()→ avoid restating yesterday
              ↓ model reasons over all of it
              propose_recommendation(...) × 0..n   ← the only write
          └─ finalize run: tokens, cost, tool trace
      └─ if any urgency ∈ {now, today}: compose one digest email
          └─ dedupe_key = (garden, local_date, channel) → send once
              └─ both users receive it; Today page shows the same set
```

The user opens the email or the Today page, sees "Section 3 — water today: 0.2″ rain in the last week and ET₀ has been high; tomatoes at fruiting stage," waters, and taps **Done**, which writes an `action_log` row linked back to the recommendation. Tomorrow's run reads that row and does not ask again.

### 2. Logging an action (ALL-7)

A user picks a location, an action type, and optionally a note; `occurred_at` defaults to now but is editable for "I watered last night." The write is immediate and unmediated by the agent — **users own the ground truth.** Every subsequent agent run reads it.

### 3. On-demand Q&A (ALL-10)

"Should I water the peppers today?" hits `/api/agent/ask`, which runs **the same engine with the same tools** and a different system prompt, streaming tokens so a multi-second answer feels responsive. The answer is grounded in the identical context the scheduled run uses, so the app cannot contradict itself between channels. This is the payoff of one engine with two entry points: ALL-10 is a new prompt and a new screen, not a new subsystem.

### 4. Re-cutting the bed for a new season (ALL-5)

Create a `season`, then draw new section boundaries as `start_ft`/`end_ft` intervals. Exposure for each new section is derived from the untouched `sun_zone` rows. Prior sections and their plantings remain intact as history. **No sun exposure is re-entered, and last year's harvest history stays queryable by position.**

Planting recommendations (ALL-11) and harvest windows (ALL-12) need no new tools or tables — they are additional prompts over this same context, which is why they can be sequenced late without being designed late.

## Handling an unverifiable knowledge source

All plant-care knowledge comes from the LLM's general training, with no curated dataset to check it against. The model can be confidently wrong about a specific crop. Since accuracy cannot be guaranteed, the architecture instead guarantees **legibility** — five concrete mechanisms:

1. **Facts and inferences are stored and displayed separately.** `recommendation.evidence` splits deterministic inputs ("0.2″ of rain in the last 7 days, none forecast for 4 days" — from Open-Meteo, cached and citable; "last watered 6 days ago" — from the action log) from model inference ("peppers at fruiting stage want deep watering every 2–3 days"). The UI renders them differently. The user can always see which part of a recommendation is checkable.
2. **Every recommendation shows its reasoning**, naming which inputs drove it. A recommendation with no visible basis is a bug.
3. **Confidence is recorded per recommendation, and phrasing follows it.** Low confidence renders as advisory ("worth checking on Section 4") rather than imperative ("prune Section 4 now").
4. **Phrasing is asymmetric to the cost of being wrong.** Cheap, reversible advice (water today) can be stated plainly. Irreversible advice (pull this plant, plant now or miss the window) requires high confidence or is explicitly framed as a judgment call. This matters because the failures in the brief have wildly different costs: a needless watering is nearly free; a crop in the wrong sun exposure is a wasted season.
5. **Users can correct the model.** `garden_note` entries are injected into every run's context, turning "the model is wrong about our microclimate" into a durable fix without a dataset.

Plus two standing statements, shown once during onboarding and available in the footer rather than repeated on every card (repetition trains users to ignore them): that guidance is AI-generated from general plant knowledge and is not a verified gardening reference, and that **without sensors the system cannot see this specific yard's microclimate.** Harvest timing is always presented as a *window*, never a single date.

## Infrastructure & deployment

- **Deploy**: push to `main` → Vercel builds and deploys. Preview deploys per branch.
- **Migrations**: Drizzle SQL migrations, applied deliberately, checked into the repo.
- **Seed**: `scripts/seed.ts` creates the real garden — the 50′ bed, its sun zones, and the 8 pots — so the demo runs on real data rather than fixtures.
- **Schedule**: `.github/workflows/checkin.yml` fires daily at 06:00 garden-local (expressed in UTC) and POSTs to the check-in endpoint with a bearer secret. Chosen over Vercel Hobby cron, which allows only one run per day, only in UTC, and only within ±59 minutes of the target.
- **Backups**: Supabase's free tier includes **no automated backups**. A weekly GitHub Actions `pg_dump` retained as a build artifact covers this. The garden profile is hand-entered and slow to recreate; the action log is irreplaceable.
- **Observability**: the `agent_run` table is the primary record — every run's inputs, tool trace, tokens, cost, and outcome. Vercel function logs are secondary. An internal `/runs` page renders recent runs, which doubles as demo material for showing autonomous tool use.
- **Secrets**: Vercel environment variables and GitHub Actions secrets. `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`, `ALLOWED_EMAILS`. None may ever carry the `NEXT_PUBLIC_` prefix, which would inline them into the client bundle.

### Suggested build sequence

Ordered so the agentic core — the thing the capstone is graded on and the thing most likely to surprise — is exercised early, and so the riskiest work does not land in the final week.

| Phase | Work | Rationale |
| --- | --- | --- |
| 1 (days 1–4) | Deploy skeleton, schema, auth + allowlist, seed real garden | Nothing can be demoed without a deployed URL and real data |
| 2 (days 4–9) | Garden profile CRUD, action log | The agent is worthless without ground truth to reason over |
| 3 (days 8–16) | **Agent engine, tools, weather, recommendations, Today page** | The demo spine. Start it before the UI is polished |
| 4 (days 14–20) | Scheduled run, email digest, run observability, demo weather mode | Makes the behavior *proactive*, which is the graded property |
| 5 (days 18–24) | Q&A (same engine, new prompt) | Cheap once phase 3 exists |
| 6 (days 22–28) | Harvest windows, then planting recommendations if time | Both are prompts over existing context; genuinely deferrable |
| Buffer (final 3–4 days) | Real-data seeding, demo script, rehearsal | Protects against demo-day surprises |

### Estimated running cost

| Item | Monthly |
| --- | --- |
| Vercel, Supabase, Open-Meteo, Gmail, GitHub Actions | $0 |
| Anthropic — daily check-in (Sonnet, ~1 run/day) | ~$5–8 |
| Anthropic — Q&A (Haiku, light use) | ~$3–8 |

Rough figures, not quotes. Two things keep this down: **prompt caching** for the garden profile, which is re-sent on every tool round trip and barely changes, and Haiku for Q&A. Because this is the only non-free dependency, a hard monthly token budget with a kill switch is specified as a security/cost control rather than left to good intentions.

## Open decisions

- **Garden coordinates, timezone, and hardiness zone** — needed before the weather integration works. The build sequence assumes `America/Los_Angeles` as a placeholder for the cron schedule; this must be confirmed.
- **Current season contents** — how the bed is divided right now and what is actually in the ground, needed for the seed script and for a demo with real plantings.
- **Whether planting recommendations (ALL-11) make the September demo.** They address the most expensive failures but demo worst in September, when the windows have passed. The architecture keeps them cheap to add late; the call belongs to the PO.
- **Web push** — deferred. Revisit only if email proves insufficient; on iOS it requires the app be added to the home screen.
- **Monthly spend cap value** for the Anthropic budget kill switch.
- **Post-capstone plan** — if the app goes unused for a week the Supabase project pauses. Fine for a capstone, decide before relying on it next season.

## Known constraints & tradeoffs

**Deliberately left simple:**

- **No multi-tenancy.** One garden, referenced as a singleton. No `garden_id` scoping discipline, no tenant isolation tests. If a second household ever mattered this would be real work, and that is an acceptable trade for a household of two.
- **No roles or per-record permissions.** Both users are equal members.
- **No queue, no cache layer, no background worker pool.** One daily job and a handful of interactive requests. A queue for two users would be architecture theater.
- **Free-text crop names** rather than a normalized crop catalogue, with an optional slug for grouping. Building a crop taxonomy would be a data-entry project competing with the deadline, and the LLM handles "sungold tomato" fine.

**Accepted limitations:**

- **Plant-care guidance is unverifiable.** Mitigated by legibility, not accuracy — see above.
- **No microclimate awareness.** No sensors, so recommendations reason from a regional forecast and cannot know that one end of the bed stays soggy. Stated plainly to users; partially correctable via `garden_note`.
- **The LLM is the one paid dependency.** Contained by a provider seam, prompt caching, a spend cap, and Haiku for cheap paths.
- **Free-tier operational edges**: Supabase pauses after 7 days idle (the daily cron prevents it) and has no automated backups (weekly `pg_dump` covers it); Supabase platform logs retain 1 day (the `agent_run` table covers it); Vercel Hobby cron is too coarse (GitHub Actions covers it).
- **Email deliverability is not guaranteed.** Gmail SMTP to two addresses is a low-risk path, but if a digest lands in spam the proactive feature silently fails. The Today page is the durable source of truth, and delivery is verified rather than assumed.
- **The demo depends on weather that may not cooperate.** The top success criterion is the agent visibly changing a recommendation because of live weather. Early September may simply be dry. A labeled simulated-weather mode runs the real agent against a substituted forecast so the behavior can be shown on demand — a requirement driven by the demo, not by the product.
