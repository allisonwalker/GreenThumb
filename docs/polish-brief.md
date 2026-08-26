# Increment brief: bolder, then polish (Impeccable → PO → fullstack-dev)

This brief is the product source of truth for a **two-phase visual finish** on Jory Journal before the September demo. It exists so `/impeccable` and the **po** skill produce Linear stories a **fullstack-dev** session can pick up cold.

It does not replace `docs/project-brief.md`. That document still owns users, matching vs LLM, and v1 scope. This increment owns how **sure of itself** the existing surfaces should look (bolder), then how **finished** that same world should feel (polish).

**Order is load-bearing.** Impeccable polish is refinement of an incumbent world. If we polish the quiet shadcn app and then bolder it, we polish a look we intend to discard. Bolder first; rewrite `DESIGN.md` to match what shipped; polish only that world.

## One-liner

Allison and her husband should feel the same conviction on Today that the landing already has — then be able to finish the daily loop on a phone without fighting incomplete states or inconsistent chrome.

## Problem

The product is approaching demo-ready **behavior** while the **interface** was built without a design track. Landing and sign-in already got a `/impeccable bolder` pass (full-viewport forest field, oversized type, shell off). Signed-in Operate screens (shell, Today, Garden, Catalog, Log, Ask) still read flat: Arial, `neutral-*`, mixed green labels, default cards.

Polishing Operate as it stands would lock in that quiet look. The gap vs landing would stay a product apology in the demo.

**What this increment is not:** a new tab, a matching/auth/data change, or an unbounded redesign that invents a third visual world. Bolder **amplifies** a world we already own. It does not replace product facts, claims, or task flows.

## Target users

Unchanged: Allison and her husband, two equals, one garden, phone in the yard and desktop in the kitchen. Neither is a specialist. Boldness is so the demo and daily use feel like one product; it must not hide the primary action (mark a task done, open a location, send an Ask).

## Goals & success criteria

**Phase A — bolder (conviction)**

- A stranger glancing at Today (and then Garden / Catalog / Log / Ask) can tell it is the same product as `/` without reading the logo twice: same motif, type at full strength, one decisive hierarchy move per screen — not more effects on every element.
- Primary tasks stay obvious. Amplification is a peak in hierarchy, not every row shouting.
- No new product claims. Copy stays `PRODUCT.md` voice (plain, practical, household).
- Conventions that drive an action (nav destinations, mark-done / dismiss, setup redirect, Ask send) still work the same way.

**Phase B — polish (finish)**

- Same names, control language, and empty/error/success states across those paths on ~390px and laptop.
- Keyboard + finger: visible focus, labeled inputs, usable tap targets.
- Detector-clean is evidence, not done. Walk the rendered path.

**For the builder**

- Phase A tickets ship an amplified look **and** update `DESIGN.md` so Phase B has a world to preserve.
- Phase B tickets are not accepted against pre-bolder screenshots.

## Two phases (do not merge in one ticket)

| Phase | Impeccable | User value | PO / fullstack-dev |
| --- | --- | --- | --- |
| **A. Bolder** | `document` → promote landing motif into the shared system if Operate cannot express it yet → `bolder [target]` per surface | The signed-in app looks sure of itself | One shippable story per surface (plus one shared-system story). **Model: M** typical; **L** if the shared-token lift is ambiguous. |
| **A′. Recapture** | `document` again (or a short DESIGN.md rewrite in the last A ticket) | Incumbent world is the **bold** one | Do not start Phase B until this exists. |
| **B. Polish** | `audit` / optional `critique` → implement AC → `polish [target]` as verify | The bold app is actually usable and consistent | P0/P1 first (blocked tasks, a11y, missing states), then drift vs **post-bolder** `DESIGN.md`. |

**Impeccable `bolder.md` constraints PO must copy into AC:**

- Touch only the named target. Neighbors stay until their own ticket.
- Amplify what the **system already owns**. Do not add a color, font, radius, shadow, or primitive the surface does not own — unless a prior **shared-system** ticket promoted it (see fork below).
- Commit one decisive move, then quiet the rest. If everything got louder, the screen got flatter.
- Skeleton test: hierarchy should still say what the screen is with copy stripped.
- Hand off to polish only when the target holds without pulling the product apart.

**Command routing**

- **`bolder`** — Phase A default for Operate surfaces. Landing/sign-in: **no second bolder** unless audit shows they went timid again.
- **`document` / `extract`** — capture and promote tokens. Required before Operate can “look like landing” without smuggling new primitives mid-ticket.
- **`audit` / `critique`** — Phase B evidence. Running them on the quiet UI is optional reconnaissance only; those findings are stale after bolder.
- **`polish`** — Phase B verify / residual refinement. Never a substitute for bolder.
- **`harden` / `adapt` / `clarify`** — Phase B children (states, viewports, labels). Ask before changing factual care claims.
- **`quieter` / `overdrive` / `delight` / new font as brand** — out of scope unless a later brief reopens identity.

## Shared jobs (unchanged from the pipeline)

Do not let Impeccable and fullstack-dev both implement the same phase unbound:

1. Impeccable **directs** (bolder playbook, then audit).
2. PO **tickets** (user story, AC, `Model: S\|M\|L`).
3. fullstack-dev **implements** one Ready-for-Dev issue per session.
4. Impeccable **verifies** (`polish` after B; after A, a screenshot walk is enough — do not polish the bold pass in the same breath).

Triage for **Phase B only** (from `polish.md`):

1. Broken tasks, misleading state, inaccessible paths
2. Missing loading / empty / error / success / disabled
3. Flow, hierarchy, responsive, design-system drift
4. Visual and motion inconsistencies
5. Code cleanup

Do not promote a polish spacing ticket on a surface that has not finished Phase A.

## Scope

**Surfaces**

| Surface | Mode | Routes | Phase A | Phase B |
| --- | --- | --- | --- | --- |
| Shared system | — | `DESIGN.md`, `globals.css`, shell, nav, tokens | Promote motif so Operate owns what landing already uses | Tokens used consistently; no one-offs |
| Marketing / auth | Persuade | `/`, `/sign-in` | Skip (already bolded) | Polish: contrast, focus, form errors, small viewports |
| Today | Operate | `/today` | Bolder | Polish path |
| Garden | Operate | `/garden`, `/garden/setup`, `/garden/[locationId]` | Bolder (list + location + setup chrome; not a map) | Polish path |
| Catalog | Operate | `/catalog`, `/catalog/[cropId]` | Bolder | Polish path |
| Log | Operate | `/log` | Bolder | Polish path |
| Ask | Operate | `/ask` | Bolder (density/hierarchy; not agent tools) | Polish path |

**In scope**

- Document before A if `DESIGN.md` is missing; document again after A.
- Shared-system lift so bolder tickets do not invent primitives.
- Per-surface bolder, then per-surface polish, sequenced Today-first if the demo clock forces a cut.
- Copy: **Jory Journal**, garden name from the singleton row, five destinations. No leftover GreenThumb in chrome. No new marketing claims.
- Phase B: mobile-first, focus, labels, contrast on light theme only, honest empty states on shipped destinations.

**Out of scope / later**

- Visual identity **replacement** (a third world that is neither landing nor amplified Operate).
- Dark mode, i18n, WCAG-as-a-project (demo floor: two people on a phone).
- Matching, weather, auth allowlist, crop-row generation, Ask tools.
- Sixth nav item, spatial bed map, sensors, motion for its own sake.
- Polishing Operate **before** its bolder ticket ships.
- A second `bolder` on `/` and `/sign-in` as a stand-in for Phase A.

## Constraints & assumptions

- **Deadline:** ~**September 3, 2026**. Prefer Today + shell fully through A then B over a timid pass on every tab.
- **Stack:** Next.js, Tailwind, existing shadcn. No new component library.
- **Voice:** `PRODUCT.md`.
- **`bolder` does not expand the system in the same ticket as a page.** If Operate cannot express the landing motif, PO splits: (1) promote tokens/components, (2) bolder the page using only those.
- Detector findings on pre-bolder code are not Phase B AC.

## What already exists

- `PRODUCT.md`; no `DESIGN.md`.
- Landing/sign-in already amplified; Operate still quiet; shell skips marketing routes.
- Today, Garden, Catalog, Log, Ask exist in code — verify before writing AC.

## Story seeds for PO

Parent is an epic (Backlog/Todo), not Ready for Dev. Sequence children with `blockedBy` **between children**, never child blocked by the epic.

**Phase A**

1. **Capture current worlds in `DESIGN.md`** — Persuade (landing) vs Operate (shell), including the landing motif as the system’s strongest existing move.
2. **Promote shared tokens / chrome** so signed-in routes can use that motif without new primitives mid-page. Blocks all other A children.
3. **Bolder Today**
4. **Bolder Garden** (list, setup, location)
5. **Bolder Catalog**
6. **Bolder Log**
7. **Bolder Ask**
8. **Recapture `DESIGN.md`** as the post-bolder incumbent (can fold into the last A ticket if small).

**Phase B** (only after 8, or after each surface’s A ticket if PO wants Today demo-ready first: then B-Today may follow A-Today, with a note that later A tickets must not regress Today)

9. **Audit + polish shared chrome**
10. **Polish Today** (states, a11y, drift vs new DESIGN.md)
11. **Polish Garden**
12. **Polish Catalog**
13. **Polish Log**
14. **Polish Ask**
15. **Polish landing + sign-in** (refinement only)

## Open questions

- **How far does Operate inherit landing?** Default: **same motif and type conviction**, still Operate density (task list, not a poster covering the fold). If a bolder ticket cannot express that without new primitives, stop and use story 2 — do not invent a third palette.
- **Cut line for the demo.** Default: Phase A+B complete for **shell + Today**; other tabs at least through A. Confirm if you want every tab through B.
- **A11y bar** still the demo floor unless the course names WCAG.

## How to run (paste-friendly)

**Phase A**

1. New session: `/impeccable document`. If Operate cannot reuse landing’s motif, stop for a PO ticket to promote tokens (`extract` / shared chrome) — do not expand the system inside a page bolder.
2. New session: **po** — Phase A seeds; Guided unless you trust Autopilot; briefs = this file + `docs/project-brief.md`.
3. New session per ticket: **fullstack-dev**. After each A ticket, Impeccable may restyle in-session only if the ticket AC says so; otherwise fullstack-dev implements the AC (which should cite `bolder.md` rules).
4. Recapture `DESIGN.md`.

**Phase B**

5. New session: `/impeccable audit` on a **post-bolder** target (start with shell + Today).
6. New session: **po** — Phase B seeds from that audit.
7. fullstack-dev per ticket; then `/impeccable polish [target]` to verify. Leftover P0/P1 return to PO.
