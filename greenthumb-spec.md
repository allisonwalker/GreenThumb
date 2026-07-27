GreenThumb

An agentic care assistant for home gardens — AI Capstone Product Spec

Problem
Allison and her husband grow a home garden but lack a system to track what each plant needs, when. Watering, fertilizing, and pruning decisions are made ad hoc, without accounting for weather, plant stage, or house-specific conditions (sun exposure, soil, hardiness zone). This leads to inconsistent care, missed windows for planting and harvest, and reliance on memory or scattered research.

Goals — MVP Scope
Primary: recommend and remind Allison and her husband when to water, fertilize, and prune each plant, based on plant type, growth stage, and local weather conditions.
Secondary: suggest what to plant, where in the garden, and when, using hardiness zone and general plant data.
Secondary: predict and flag optimal harvest windows per plant.
Core technical requirement: an agentic component — not just static rules — that reasons over live conditions and proactively acts.

Non-Goals (v1)
No physical sensors (soil motemperature probes) — conditions come from weather API + manually entered garden data.
No computer vision / plant identification from photos.
No e-commerce, seed ordering, or marketplace features.
No community or multi-household/social features — built for a single household (2 users).

Users
Two primary users: Allison and her husband, co-managing one home garden. Both need visibility into the same plant data and care schedule; either should be able to log actions (red, pruned, harvested) and receive alerts.

Core Features
Care Management (priority #1): per-plant watering, fertilizing, and pruning schedule that adjusts dynamically — e.g., skip watering after rain, flag frost risk, adjust fertilizer cadence by growth stage.
Planting Recommendations: suggested plants, bed placement, and planting dates based on hardiness zone, sun exposure, and bed layout entered by the user.
Harvest Timing: predicted harvest window per plant, refined as the user logs planting dates and observed growth.
Garden Profile: manual setup of beds, soil type, sun exposure, hardiness zone, and current plantings.
Action Log: simple log of what was done (watered, fertilized, pruned, harvested) that feeds back into the agent's reasoning.

Agentic AI Approach
The core technical differentiator is an LLM-based age, not a static rules engine, with two modes:
Proactive check-ins: on a daily/weekly cadence, the agent pulls current + forecast weather, cross-references each plant's stage and care history, and decides whether action is needed (e.g., “skip watering — rain expected,” “frost tonight, cover the tomatoes”).
On-demand Q&A: Allison or her husband can ask the agent direct questions (“should I water today?”, “when should I harvest the peppers?”) and it reasons over the same data to respond.
Tool use: the agent calls out to a weather API and a plant-care knowledge source itself to gather what it needs before responding — this orchestration is the agentic piece worth demonstrating for the course.

Data Inputs
st data via a weather API (tied to zip code or coordinates).
Manually entered garden details: hardiness zone, soil type, sun exposure, bed layout, current plantings.
General plant-care reference data (watering/fertilizing/pruning norms, days-to-harvest) — no live sensors in v1.

Platform & Notifications
Platform: web app, accessible to both users from any device.
Notifications: text message alerts for time-sensitive actions (e.g., frost warning, “water today”); full detail and history live in the web app.

Success Metrics
Functional: agent correctly adjusts at least one care recommendation (e.g., skips watering) in response to real weather data during a live demo.
Usability: both Allison and her husband can set up their garden profile and receive a relevant recommendation without asce.
Course requirement: clear demonstration of agentic behavior — proactive reasoning and autonomous tool use, not just prompt-response Q&A.

Open Questions / Risks
Plant-care knowledge source: use a static reference dataset vs. have the LLM reason from general knowledge — affects accuracy and scope.
Text alerts require an SMS provider (e.g., Twilio) — adds a dependency and small cost outside free-tier course tools.
Accuracy of generic plant-care rules vs. the specific microclimate of one house is inherently limited without sensors — worth stating as a known v1 limitation.
