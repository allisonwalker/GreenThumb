# Design

Incumbent look of Jory Journal **after Phase A** (shared tokens, amplified chrome, bolder Today / Garden / Catalog / Log / Ask). Phase B polish **refines this world**. Do not invent a third palette, a new display font, or a new motif. Product facts and chrome (Jory Journal + garden name, five destinations) stay in `PRODUCT.md` and `docs/architecture.md`. This file is look only.

**One product language:** forest/cream motif and type conviction everywhere. Persuade fills the fold with a forest poster. Operate uses the same tokens at **task-list density** (usable nav, one title peak, quieter rows). Shell chrome is forest/cream from promoted `@theme` names in `app/globals.css`.

**Superseded (do not preserve):** pre-bolder quiet Operate — Arial/`neutral-*` page bodies, `text-3xl font-bold tracking-tight` titles, green uppercase eyebrows (`text-green-700`), `green-800` primary page actions, `green-50` row hover, white/`neutral` shell, `shadow-sm` on Operate bodies. That capture (ALL-98) is historical. Polish tickets must not treat it as the system to keep.

**Do not bolder `/` or `/sign-in` again.** They are already-bold Persuade. Phase B may polish contrast, focus, and form errors on those routes only.

## Persuade

**Routes:** `/` (`app/page.tsx`) and `/sign-in` (`app/(auth)/sign-in/page.tsx`). Already amplified. Unchanged intent: marketing field, shell off, oversized type. Not an Operate surface and not a second bolder target.

**Chrome:** `AppShell` (`components/app-shell.tsx`) and `AppNav` skip these paths (`isMarketingPath` in `lib/shell/identity.ts`). Authenticated visitors are redirected to `/today`. There is no tab bar, no sticky identity header, no `garden.name` on these screens.

**Layout primitive:** `MarketingScreen` (`components/marketing-screen.tsx`) — `min-h-dvh` column, `bg-forest` and `text-cream`, `selection:bg-selection` on cream. Landing stacks a giant title + body, then a three-line punch list and a cream CTA. Sign-in splits on large screens: forest copy column + cream form column (`bg-cream text-forest`). Hex is collapsed onto named tokens.

**Motif:** inverted forest field. Dark green fills the viewport. Type and the landing primary button are cream. Sign-in inverts again on the form pane so inputs sit on light cream with forest text.

**Type:** body font is global Arial/Helvetica (`app/globals.css`). Conviction comes from **scale and weight**, not a second family.

| Surface | Headline | Supporting |
| --- | --- | --- |
| `/` | `text-display` (`clamp(3.75rem, 16vw, 8.5rem)` / leading `0.82`), `font-bold`, `tracking-display`, max ~12ch | `text-lg` / `sm:text-xl` in `text-leaf`; punch list `text-2xl` / `sm:text-3xl font-semibold` |
| `/sign-in` | `text-display-compact` (`clamp(3rem, 10vw, 6.5rem)` / leading `0.88`), `font-bold`, `tracking-display` | Eyebrow link `text-leaf-muted`; body `text-leaf` |

**Color pairing (named `@theme` tokens):**

| Role | Token | Hex | Where |
| --- | --- | --- | --- |
| Forest field | `forest` | `#172217` | `MarketingScreen` background; landing CTA text; signed-in chrome |
| Cream | `cream` | `#f7faf7` | `MarketingScreen` text; landing CTA fill; sign-in form pane; chrome type |
| Soft leaf on forest | `leaf` | `#d7e5d7` | Supporting copy; idle nav |
| Muted cream link | `leaf-muted` | `#c5d9c5` | Sign-in back-to-home label |
| Selection | `selection` | `#3d6b3d` | `MarketingScreen`; active nav |
| CTA hover | `white` | `white` | Landing button `hover:bg-white` |

Sign-in **form controls** on the cream pane still use leftover Operate-era widgets: `neutral-800` labels, white inputs, `green-800` submit, `red-50` / `red-800` allowlist errors. The field is Persuade; those widgets are a polish leftover, not a reason to bolder the route again.

## Operate

**Routes:** `/today`, `/garden` (+ `/garden/setup`, `/garden/[locationId]`), `/catalog` (+ `/catalog/[cropId]`), `/log`, `/ask`. Product chrome: constant **Jory Journal** plus `garden.name` from the singleton. Five destinations plus sign out — not a sixth tab (`docs/architecture.md`).

**Chrome:** `AuthenticatedShell` wraps the app in `AppShell`. Light page (`max-w-5xl`), desktop forest sidebar with identity + `AppNav`, mobile sticky forest header (`bg-forest`, `border-b`) and fixed forest bottom nav (`bg-forest`, `border-t`). Main padding is list-density (`py-8`, extra bottom padding on mobile for the bar). Main content stays cream — **not** a full-viewport forest field (**not a fold-covering poster**). Identity is `text-sm font-bold tracking-display text-cream` over `text-xs text-leaf` garden name. Shell uses promoted tokens (`forest`, `cream`, `leaf`, `selection`), not `neutral-*` / `bg-white` chrome.

**Nav:** Lucide icons, `text-xs` / `md:text-sm`. Active destination `bg-selection text-cream`. Idle `text-leaf` with `hover:bg-selection`. Sign out is a sixth cell, same idle treatment, not a cream-on-forest landing CTA.

**Type:** same Arial stack. Operate destinations share one title recipe — type conviction at **Operate density**, not landing’s `text-display`:

- Title: `text-5xl` / `sm:text-6xl`, `font-bold`, `leading-none`, `tracking-display`, `text-forest`
- No green uppercase eyebrow
- Body: `text-forest`
- Supporting `h2`s and labels stay quieter than the `h1`

That is quieter than landing’s `clamp` headlines. Rows, cards, and composers stay scannable lists/forms, not posters.

**Color and density:** cream `--background` shows at the edges of main; content sits on **white cards** (`rounded-2xl` or shadcn `rounded-xl`, `border`, without `shadow-sm` on Operate page bodies). Chrome is forest/cream. Page bodies use motif names (`forest`, `cream`, `leaf`, `selection`). All of them read as a **dashboard / form / list / conversation**.

**Per destination (look only; one peak, then quiet):**

- **Today** — peak: `Open garden tasks` as `h1` (title recipe above). Urgency labels are sentence-case `text-sm font-medium text-forest`. Cards stay `rounded-2xl border bg-white` without `shadow-sm`. Done is `bg-forest text-cream`; Dismiss is outline on white. Empty is a bordered white panel; matching error keeps the amber wash. Still a scannable task list.
- **Garden** — peak per route: list `h1` is `Current locations`; setup `h1` is `Your garden profile`; location `h1` is the location name. Same title recipe. Setup and location keep a quiet sentence-case breadcrumb (`Garden · Setup` / `Garden · Bed section|Pot`). **Garden setup** is an outline button on white, not a landing CTA. Rows and forms stay `rounded-2xl border bg-white` without `shadow-sm`. Primary saves are `bg-forest text-cream`; secondary actions stay outline. Bed sections then pots; each row still opens `/garden/[locationId]`. Sun-map zone colors stay as exposure legend (amber / lime / emerald / teal). Not a map and not a poster.
- **Catalog** — peak per route: list `h1` is `Crop catalog`; detail `h1` is the crop name (+ variety when present). Same title recipe. Detail keeps a quiet sentence-case `Catalog` breadcrumb back to the list. Search, add, and edit sit in `rounded-2xl border bg-white` panels without `shadow-sm`. Crop rows hover `bg-cream`. Primary add/save are `bg-forest text-cream`; Draft with Gemini is an outline button on white. Fields use `focus:border-forest` / `focus:ring-leaf`. Still a searchable table/form.
- **Log** — peak: `What we already did` as `h1` (title recipe above). Entry form (`Log an action`) and history stay quieter `h2`s. Panels stay `rounded-2xl border bg-white` without `shadow-sm`. **Log it** is `bg-forest text-cream`. Fields use `focus:border-forest` / `focus:ring-leaf`. Action chips sit on white; the selected chip is cream. Last-care filter wash is `bg-cream`. Void/correction stays `red-*`. Still a form then a history list.
- **Ask** — peak: `Ask` as `h1` (title recipe above). Mode tabs (Questions / Hours I have) and supporting copy stay quieter. Thread, empty state, and composer sit in `rounded-2xl border bg-white` panels without `shadow-sm`. **Ask** / **Plan my hours** are `bg-forest text-cream`. Fields use `focus:border-forest` / `focus:ring-leaf`. Selected mode tab is cream-on-forest; idle is outline on white. Still a conversation column; the composer stays reachable.

## Intent for Phase B

Audit **drift against this file**. Same motif, type recipe, and Operate density. Do not restore superseded quiet Operate. Do not restyle Persuade as a stand-in for polish. Do not invent new hex or a new font — use `forest` / `cream` / `leaf` / `leaf-muted` / `selection` / `text-display` / `text-display-compact` / `tracking-display`.

## Primitives (honest inventory)

Promoted into `@theme` in `app/globals.css`. Do not invent a third set.

**CSS variables (`app/globals.css`):**

| Token | Value | Notes |
| --- | --- | --- |
| `--color-forest` | `#172217` | Motif field; `--foreground` aliases this |
| `--color-cream` | `#f7faf7` | Motif type/CTA; `--background` aliases this |
| `--color-leaf` | `#d7e5d7` | Soft leaf on forest |
| `--color-leaf-muted` | `#c5d9c5` | Muted cream link |
| `--color-selection` | `#3d6b3d` | Selection / active chrome |
| `--color-line` | `#dbe5db` | Global `* { border-color }` |
| `--font-sans` | Arial, Helvetica, sans-serif | One family, both worlds |
| `--text-display` | `clamp(3.75rem, 16vw, 8.5rem)` | Landing headline; line-height `0.82` |
| `--text-display-compact` | `clamp(3rem, 10vw, 6.5rem)` | Sign-in headline; line-height `0.88` |
| `--tracking-display` | `-0.04em` | Type-strength tracking |

`--background` and `--foreground` remain as aliases of cream and forest.

**Hardcoded marketing hex** is retired from components. Those same values (`#172217`, `#f7faf7`, `#d7e5d7`, `#c5d9c5`, `#3d6b3d`) are the theme tokens above, plus `white` hover on the landing CTA.

**Tailwind leftovers:** sign-in form widgets still use `neutral-*` and `green-800`. Operate page bodies no longer do.

**Tailwind on Operate page bodies:** **Today** uses motif names (`forest`, `cream`, `selection`) plus `amber-*` for matching error. **Garden** uses motif names (`forest`, `cream`, `leaf`, `selection`) plus `amber-*` for out-of-season, `red-*` for remove/errors, and sun-map legend colors (`amber-300` / `lime-300` / `emerald-300` / `teal-500`). **Catalog** uses motif names (`forest`, `cream`, `leaf`, `selection`) plus `red-*` for save/create errors. **Log** uses motif names (`forest`, `cream`, `leaf`, `selection`) plus `red-*` for save errors and void. **Ask** uses motif names (`forest`, `cream`, `leaf`, `selection`) plus `red-*` for send errors. Chrome uses `forest` / `cream` / `leaf` / `selection`.

**Components:** `MarketingScreen` (Persuade only), `AppShell` / `AppNav` (Operate only; skipped on marketing paths), shadcn `Card` (white, `rounded-xl`, `shadow-sm`). Radius on marketing/Operate CTAs is `rounded-lg`; task cards often `rounded-2xl`.
