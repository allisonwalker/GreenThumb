# Design

Capture of Jory Journal **as it looks today**, before Phase A bolder work. Two incumbent worlds already exist. Do not invent a third palette, a new display font, or a new motif. Product facts and chrome (Jory Journal + garden name, five destinations) stay in `PRODUCT.md` and `docs/architecture.md`. This file is look only.

**Strongest existing move:** the Persuade forest field — full-viewport forest (`#172217`) with cream (`#f7faf7`) type, oversized bold headlines, shell off. Named tokens for that motif live in `app/globals.css`. Signed-in **chrome** now uses forest/cream at Operate density (usable nav, not a fold-covering poster). **Today and Garden page titles** now use that type conviction at list density. Catalog, Log, and Ask bodies stay quiet until their bolder tickets.

## Persuade

**Routes:** `/` (`app/page.tsx`) and `/sign-in` (`app/(auth)/sign-in/page.tsx`).

**Chrome:** `AppShell` (`components/app-shell.tsx`) and `AppNav` skip these paths (`isMarketingPath` in `lib/shell/identity.ts`). Authenticated visitors are redirected to `/today`. There is no tab bar, no sticky identity header, no `garden.name` on these screens.

**Layout primitive:** `MarketingScreen` (`components/marketing-screen.tsx`) — `min-h-dvh` column, `bg-forest` and `text-cream`, `selection:bg-selection` on cream. Landing stacks a giant title + body, then a three-line punch list and a cream CTA. Sign-in splits on large screens: forest copy column + cream form column (`bg-cream text-forest`). Hex is collapsed onto those names; this is not a second bolder pass.

**Motif:** inverted forest field. Dark green fills the viewport. Type and the landing primary button are cream. Sign-in inverts again on the form pane so inputs sit on light cream with forest text.

**Type:** body font is still global Arial/Helvetica (`app/globals.css`). Conviction comes from **scale and weight**, not a second family.

| Surface | Headline | Supporting |
| --- | --- | --- |
| `/` | `text-display` (`clamp(3.75rem, 16vw, 8.5rem)` / leading `0.82`), `font-bold`, `tracking-display`, max ~12ch | `text-lg` / `sm:text-xl` in `text-leaf`; punch list `text-2xl` / `sm:text-3xl font-semibold` |
| `/sign-in` | `text-display-compact` (`clamp(3rem, 10vw, 6.5rem)` / leading `0.88`), `font-bold`, `tracking-display` | Eyebrow link `text-leaf-muted`; body `text-leaf` |

**Color pairing (named `@theme` tokens; same hex as before):**

| Role | Token | Hex | Where |
| --- | --- | --- | --- |
| Forest field | `forest` | `#172217` | `MarketingScreen` background; landing CTA text; signed-in chrome |
| Cream | `cream` | `#f7faf7` | `MarketingScreen` text; landing CTA fill; sign-in form pane; chrome type |
| Soft leaf on forest | `leaf` | `#d7e5d7` | Supporting copy; idle nav |
| Muted cream link | `leaf-muted` | `#c5d9c5` | Sign-in back-to-home label |
| Selection | `selection` | `#3d6b3d` | `MarketingScreen`; active nav |
| CTA hover | `white` | `white` | Landing button `hover:bg-white` |

Sign-in **form controls** on the cream pane drop back into Operate language: `neutral-800` labels, white inputs, `green-800` submit, `red-50` / `red-800` allowlist errors. The field is Persuade; the form widgets are already the quiet system.

## Operate

**Routes:** `/today`, `/garden` (+ `/garden/setup`, `/garden/[locationId]`), `/catalog` (+ `/catalog/[cropId]`), `/log`, `/ask`. Product chrome: constant **Jory Journal** plus `garden.name` from the singleton. Five destinations plus sign out — not a sixth tab (`docs/architecture.md`).

**Chrome:** `AuthenticatedShell` wraps the app in `AppShell`. Light page (`max-w-5xl`), desktop forest sidebar with identity + `AppNav`, mobile sticky forest header (`bg-forest`, `border-b`) and fixed forest bottom nav (`bg-forest`, `border-t`). Main padding is list-density (`py-8`, extra bottom padding on mobile for the bar). Main content stays cream — not a full-viewport forest field. Identity is `text-sm font-bold tracking-display text-cream` over `text-xs text-leaf` garden name.

**Nav:** Lucide icons, `text-xs` / `md:text-sm`. Active destination `bg-selection text-cream`. Idle `text-leaf` with `hover:bg-selection`. Sign out is a sixth cell, same idle treatment, not a cream-on-forest landing CTA.

**Type:** same Arial stack. Page pattern is repeated, not poster-scale:

- Eyebrow: `text-sm font-semibold uppercase tracking-wide text-green-700`
- Title: `text-3xl font-bold tracking-tight` (`sm:text-4xl` on most destinations; Ask stays `text-3xl`)
- Body: `text-neutral-600`

That is one hierarchy step above body copy on destinations that have not had a bolder ticket yet. It is quieter than landing’s `clamp` headlines. **Today and Garden** are the exception: page titles use `text-5xl` / `sm:text-6xl`, `leading-none`, and `tracking-display` in `text-forest` — type conviction at Operate density, not `text-display`.

**Color and density:** cream `--background` shows at the edges of main; content sits on **white cards** (`rounded-2xl` or shadcn `rounded-xl`, `border`; Catalog / Log / Ask still often `shadow-sm`). Chrome is forest/cream. Catalog, Log, and Ask still use mixed greens (`green-700` eyebrows, `green-800` primary buttons / links, `green-50` washes) plus Tailwind `neutral-*`. Today and Garden page bodies use motif names. All of them read as a **dashboard / form / list**, not a marketing fold.

**Per destination (look only):**

- **Today** — one peak: `Open garden tasks` as `h1` (`text-5xl` / `sm:text-6xl`, `font-bold`, `leading-none`, `tracking-display`, `text-forest`). No green uppercase eyebrow. Urgency labels are sentence-case `text-sm font-medium text-forest`. Cards stay `rounded-2xl border bg-white` without `shadow-sm`. Done is `bg-forest text-cream`; Dismiss is outline on white. Empty is a bordered white panel; matching error keeps the amber wash. Not a forest poster; still a scannable task list.
- **Garden** — one peak per route: list `h1` is `Current locations`; setup `h1` is `Your garden profile`; location `h1` is the location name. Same type recipe as Today (`text-5xl` / `sm:text-6xl`, `leading-none`, `tracking-display`, `text-forest`). No green uppercase eyebrow. Setup and location keep a quiet sentence-case breadcrumb (`Garden · Setup` / `Garden · Bed section|Pot`). **Garden setup** is an outline button on white, not a cream-on-forest landing CTA. Rows and forms stay `rounded-2xl border bg-white` without `shadow-sm`. Primary saves are `bg-forest text-cream`; secondary actions stay outline. Bed sections then pots; each row still opens `/garden/[locationId]`. Sun-map zone colors stay as exposure legend (amber / lime / emerald / teal). Not a map and not a poster.
- **Catalog** — search/edit list; crop edit reuses the green eyebrow + `text-3xl` title.
- **Log** — form then history; same header recipe.
- **Ask** — same eyebrow/title, then a conversation column and `green-700` focus rings on the composer.

**Today and Garden** now share landing’s motif and type conviction at Operate density. Catalog, Log, and Ask page bodies **still read quieter than landing** until their own tickets. Same product: Persuade fills the fold; chrome is forest/cream; Today and Garden titles are the Operate peak; remaining Operate pages are still modest type + default cards.

## Intent for later bolder (page tickets)

Operate chrome already shares landing’s **motif and type conviction** at **Operate density**. **Today and Garden titles** do too (`tracking-display`, not `text-display`). Catalog, Log, and Ask still read quieter than landing until their own tickets. Do not restyle `/` or `/sign-in` again as a stand-in. Do not invent new hex or a new font in a page ticket — use `forest` / `cream` / `leaf` / `leaf-muted` / `selection` / `text-display` / `tracking-display`. Recapture this file after remaining page bolders ship.

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

**Tailwind on Operate page bodies:** Catalog, Log, and Ask still use `neutral-*`, `green-50` / `green-200` / `green-700` / `green-800` / `green-900`, `red-*`, `white`, default `border`. **Today** uses motif names (`forest`, `cream`, `selection`) plus `amber-*` for matching error. **Garden** uses motif names (`forest`, `cream`, `leaf`, `selection`) plus `amber-*` for out-of-season, `red-*` for remove/errors, and sun-map legend colors (`amber-300` / `lime-300` / `emerald-300` / `teal-500`). Chrome uses `forest` / `cream` / `leaf` / `selection`.

**Components:** `MarketingScreen` (Persuade only), `AppShell` / `AppNav` (Operate only; skipped on marketing paths), shadcn `Card` (white, `rounded-xl`, `shadow-sm`). Radius on marketing/Operate CTAs is `rounded-lg`; task cards often `rounded-2xl`.
