# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Allison and her husband co-manage one home garden. There is no third persona and no multi-household case. Neither is a specialist; both need the same plant data and care schedule, and either should be able to log work (watered, fertilized, pruned, harvested).

The garden that sets the scale: one ~50′ × 3′ raised bed (5–6 user-defined sections that can be re-cut each season) plus eight physically fixed pots. Sun and soil are stable; what changes is plantings and how the bed is divided. About 13–14 growing locations.

## Product Purpose

Jory Journal remembers this one bed and its pots, computes a daily care list from stored crop needs crossed with weather and the care log, and uses an LLM only when they want to talk through that list — especially how to spend a limited number of hours.

Success for a season: every bed section produces a harvest; nothing dies of thirst; no planting is doomed by the wrong sun; no planting window is missed; on a short weekend they spend the hours they have on the work that most needs doing.

## Positioning

Daily watering, harvest, and planting advice is matching, not a model: stored crop rows × rain/ET₀ × the care log, with templated copy you can check (“skipped watering because rain is coming”). A generic chatbot with no garden state cannot truthfully copy that. The model earns its keep on conversation over this garden (Q&A, time-budgeting an already-computed list) and on a one-shot draft of a crop-care row when a crop first appears.

## Operating Context

Used as a mobile-first web app from phone or desktop, typically at home or in the garden. Setup is manual (locations, sun, soil, zone, plantings). The default surface is Today’s open task list; they do not have to ask. Optional Ask conversation when they have a question or a time budget. Care is logged so matching does not nag again. Weather is Open-Meteo keyed to the garden location. Auth is two allowlisted magic-link accounts for one household.

## Capabilities and Constraints

Confirmed in v1: garden profile; searchable/editable crop catalog (LLM drafts the first row for a crop); deterministic daily care list (water, fertilize, prune, harvest, frost, planting window); action log; Ask / time-budget; planting-fit warnings; harvest windows from crop rows + planting dates; web access for both users; push or email for time-sensitive items (not SMS).

Out of scope / later: LLM as the daily care engine; sensors; computer vision; e-commerce; community or extra households; a full plant encyclopedia; yield/volume planning.

Technical: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Drizzle, Supabase Postgres, Vercel; free or near-free tiers; LLM behind a provider seam for conversation and crop-row draft only. Known limitation: without sensors, recommendations cannot account for this yard’s microclimate; correction is editing the crop row and garden notes.

Undecided: none recorded in this init (product facts above are confirmed).

## Brand Commitments

Name: Jory Journal (formerly GreenThumb). Voice: plain, practical, household — not expert-gardener jargon or startup hype. No additional identity rules were confirmed. The repository, package, and deploy hostname may still say GreenThumb; the product name shown to people is Jory Journal.

## Evidence on Hand

Real garden is the product: deployed app at green-thumb-orpin.vercel.app; seed and schema for this household’s bed, sun map, and pots. Do not invent other customers, testimonials, press, pricing, or a multi-garden case. `greenthumb-spec.md` is superseded by `docs/project-brief.md` for product truth.

## Product Principles

- Default to the computed list. Conversation is optional overlay, never the source of today’s watering tasks.
- Advice must be checkable against stored numbers and this garden’s state.
- One household, one garden, two equals — design for shared use, not personas or tenancy.
- Prefer a generated-then-edited crop row over hoping tomorrow’s prompt is smarter.
- Stay usable without gardening expertise and without a design-system hobby: the job is care, not catalog browsing.

## Accessibility & Inclusion

Mobile-first for two non-specialists. No WCAG target or additional user needs were established as a v1 product requirement.
