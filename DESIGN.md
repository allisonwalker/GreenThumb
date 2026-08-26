# Design

Capture of Jory Journal **as it looks today**, before Phase A bolder work. Two incumbent worlds already exist. Do not invent a third palette, a new display font, or a new motif. Product facts and chrome (Jory Journal + garden name, five destinations) stay in `PRODUCT.md` and `docs/architecture.md`. This file is look only.

**Strongest existing move:** the Persuade forest field — full-viewport `#172217` with cream `#f7faf7` type, oversized bold headlines, shell off. Operate should later inherit that **motif and type conviction** at **Operate density** (task list / dashboard, not a fold-covering poster). Promoting those primitives into shared tokens is the next story, not this one.

## Persuade

**Routes:** `/` (`app/page.tsx`) and `/sign-in` (`app/(auth)/sign-in/page.tsx`).

**Chrome:** `AppShell` and `AppNav` skip these paths (`pathname === "/"` or `pathname.startsWith("/sign-in")` in `components/app-shell.tsx` and `components/app-nav.tsx`). Authenticated visitors are redirected to `/today`. There is no tab bar, no sticky identity header, no `garden.name` on these screens.

**Layout primitive:** `MarketingScreen` (`components/marketing-screen.tsx`) — `min-h-dvh` column, hardcoded `bg-[#172217]` and `text-[#f7faf7]`, selection `#3d6b3d` on cream. Landing stacks a giant title + body, then a three-line punch list and a cream CTA. Sign-in splits on large screens: forest copy column + cream form column (`bg-[#f7faf7] text-[#172217]`).

**Motif:** inverted forest field. Dark green fills the viewport. Type and the landing primary button are cream. Sign-in inverts again on the form pane so inputs sit on light cream with forest text.

**Type:** body font is still global Arial/Helvetica (`app/globals.css`). Conviction comes from **scale and weight**, not a second family.

| Surface | Headline | Supporting |
| --- | --- | --- |
| `/` | `clamp(3.75rem, 16vw, 8.5rem)`, `font-bold`, `leading-[0.82]`, `tracking-[-0.04em]`, max ~12ch | `text-lg` / `sm:text-xl` in `#d7e5d7`; punch list `text-2xl` / `sm:text-3xl font-semibold` |
| `/sign-in` | `clamp(3rem, 10vw, 6.5rem)`, `font-bold`, `leading-[0.88]`, same tracking | Eyebrow link `#c5d9c5`; body `#d7e5d7` |

**Color pairing (hardcoded hex on marketing; not Tailwind tokens):**

| Role | Hex | Where |
| --- | --- | --- |
| Forest field | `#172217` | `MarketingScreen` background; landing CTA text |
| Cream | `#f7faf7` | `MarketingScreen` text; landing CTA fill; sign-in form pane |
| Soft leaf on forest | `#d7e5d7` | Supporting copy |
| Muted cream link | `#c5d9c5` | Sign-in back-to-home label |
| Selection | `#3d6b3d` | `MarketingScreen` |
| CTA hover | `white` | Landing button `hover:bg-white` |

Sign-in **form controls** on the cream pane drop back into Operate language: `neutral-800` labels, white inputs, `green-800` submit, `red-50` / `red-800` allowlist errors. The field is Persuade; the form widgets are already the quiet system.

## Operate

**Routes:** `/today`, `/garden` (+ `/garden/setup`, `/garden/[locationId]`), `/catalog` (+ `/catalog/[cropId]`), `/log`, `/ask`. Product chrome: constant **Jory Journal** plus `garden.name` from the singleton. Five destinations plus sign out — not a sixth tab (`docs/architecture.md`).

**Chrome:** `AuthenticatedShell` wraps the app in `AppShell`. Light page (`max-w-5xl`), desktop sidebar with identity + `AppNav`, mobile sticky white header (`bg-white`, `border-b`) and fixed bottom nav (`bg-white`, `border-t`). Main padding is list-density (`py-8`, extra bottom padding on mobile for the bar). Identity is `text-sm font-semibold text-neutral-950` over `text-xs text-neutral-600` garden name.

**Nav:** Lucide icons, `text-xs` / `md:text-sm`. Active destination `bg-green-50 text-green-800`. Idle `text-neutral-600` with `hover:bg-neutral-100`. Sign out is a sixth cell, same quiet treatment, not a forest CTA.

**Type:** same Arial stack. Page pattern is repeated, not poster-scale:

- Eyebrow: `text-sm font-semibold uppercase tracking-wide text-green-700`
- Title: `text-3xl font-bold tracking-tight` (`sm:text-4xl` on most destinations; Ask stays `text-3xl`)
- Body: `text-neutral-600`

That is one hierarchy step above body copy. It is quieter than landing’s `clamp` headlines.

**Color and density:** cream `--background` shows at the edges; content sits on **white cards** (`rounded-2xl` or shadcn `rounded-xl`, `border`, `shadow-sm`). Mixed greens (`green-700` eyebrows, `green-800` active nav / primary buttons / links, `green-50` washes) plus Tailwind `neutral-*`. Default shadcn Card is white + border + light shadow. Today tasks, Garden rows, Catalog, Log, and Ask thread all read as a **dashboard / form / list**, not a marketing fold.

**Per destination (look only):**

- **Today** — grouped task cards, Done (`bg-green-800 text-white`) vs Dismiss (outline `neutral`). Empty: bordered white panel.
- **Garden** — locations list then pots; setup is a bordered `green-800` text button, not a cream-on-forest CTA. Same header recipe on setup and location pages.
- **Catalog** — search/edit list; crop edit reuses the green eyebrow + `text-3xl` title.
- **Log** — form then history; same header recipe.
- **Ask** — same eyebrow/title, then a conversation column and `green-700` focus rings on the composer.

Operate **still reads quieter than landing.** Same product, two visual temperatures: Persuade fills the fold; Operate is light chrome + modest type + default cards.

## Intent for later bolder (not this ticket)

Operate should share landing’s **motif and type conviction** at **Operate density** — list and dashboard, not a fold-covering poster. Do not restyle `/` or `/sign-in` again as a stand-in. Do not start polish against this quiet Operate look; recapture this file after bolder ships.

## Primitives (honest inventory)

Extract and promote these; do not invent a third set.

**CSS variables (`app/globals.css`):**

| Token | Value | Notes |
| --- | --- | --- |
| `--background` | `#f7faf7` | Same cream as marketing text/CTA; used as document background |
| `--foreground` | `#172217` | Same forest as marketing field; used as document text |
| (untokenized) | `#dbe5db` | Global `* { border-color }` |
| `font-family` | Arial, Helvetica, sans-serif | One family, both worlds |

**Hardcoded marketing hex** (not CSS variables, not Tailwind theme keys): `#172217`, `#f7faf7`, `#d7e5d7`, `#c5d9c5`, `#3d6b3d`, plus `white` hover on the landing CTA. Forest/cream already exist as `--foreground` / `--background` but Persuade does not use the variables — it inlines hex on `MarketingScreen` and pages.

**Tailwind on Operate chrome and pages:** `neutral-50`–`neutral-950`, `green-50` / `green-200` / `green-700` / `green-800` / `green-900`, `amber-*` (Today matching error), `red-*` (errors), `white`, default `border`. No `@theme` palette in CSS; utilities are Tailwind defaults.

**Components:** `MarketingScreen` (Persuade only), `AppShell` / `AppNav` (Operate only; skipped on marketing paths), shadcn `Card` (white, `rounded-xl`, `shadow-sm`). Radius on marketing/Operate CTAs is `rounded-lg`; task cards often `rounded-2xl`.

**Gap the promote ticket must close:** forest/cream live in `:root` and again as one-off hex. Operate never paints the forest field; it uses `neutral-*` + mixed `green-*` on a light page. Type conviction (oversized bold, tight leading) lives only on Persuade pages.
