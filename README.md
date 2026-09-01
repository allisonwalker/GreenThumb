# GreenThumb (Jory Journal)

**Jory Journal** is a mobile-first web app for one household garden: a single
raised bed plus eight pots. It stores that garden’s locations, plantings, and
crop-care numbers, computes a daily Today list from those records plus weather
and the care log, and offers optional Ask conversation over that list (not as
the source of watering tasks). Sign-in is two allowlisted magic-link accounts.

The product name shown in the UI is Jory Journal. This repository, the npm
package, and the Vercel hostname still say GreenThumb.

Stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM,
Supabase Postgres, Vercel. Product truth lives in `PRODUCT.md` and
`docs/project-brief.md`. Architecture is in `docs/architecture.md`.

## Live app

**https://green-thumb-orpin.vercel.app**

Public health check (no sign-in):
[https://green-thumb-orpin.vercel.app/health](https://green-thumb-orpin.vercel.app/health)
should return `"status":"ok"` and `"database":"connected"`. Garden pages require
one of the two household emails.

## Local setup

Prerequisites:

- Node.js 22 or newer
- npm
- A Supabase project

From a fresh clone:

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy the environment template:

   ```sh
   cp .env.example .env.local
   ```

3. In Supabase, open **Project Settings → Database → Connection string**.
   Select the **Session pooler**, copy its URI, replace the password placeholder,
   and set it as `DATABASE_URL` in `.env.local`.

4. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `SITE_URL` in `.env.local`. For local development, use
   `SITE_URL=http://localhost:3000`.

5. Apply every checked-in migration with one command:

   ```sh
   npm run db:migrate
   ```

6. Start the app:

   ```sh
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000). The database health
   response is at [http://localhost:3000/health](http://localhost:3000/health).

Only server modules access Postgres. Do not add `NEXT_PUBLIC_` to database,
Supabase service-role, model, email, or cron credentials. See
[Data access and secrets](#data-access-and-secrets) for how this is enforced.

## Supabase setup

1. Create a project at [database.new](https://database.new) on the free plan.
2. Save the generated database password in a password manager.
3. Copy the **Session pooler** connection URI into `DATABASE_URL`.
4. Open **Project Settings → API Keys** and copy:
   - the **anon / publishable** key into `SUPABASE_ANON_KEY` (used for magic-link
     session cookies — do not use the service-role key here)
   - the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY`
   Both stay server-only; never give either a `NEXT_PUBLIC_` prefix.
5. Under **Authentication → URL Configuration**, set the Site URL and add
   `<SITE_URL>/auth/callback` to the allowed redirect URLs. Add both local and
   deployed callback URLs when testing both environments.
6. Ensure the email provider is enabled under **Authentication → Providers**.
7. Under **Authentication → Providers → Email**, turn **off** “Allow new users
   to sign up” (open signup). GreenThumb admits only the two household
   addresses via `ALLOWED_EMAILS`; leaving open signup on would let Supabase
   create accounts for other addresses even though the app callback rejects
   them. Create the two household users first (sign in once with signup still
   on, or invite them from the Auth dashboard), then disable open signup.
8. Set `ALLOWED_EMAILS` in `.env.local` to a comma-separated list of the two
   permitted addresses (see `.env.example`). Changing who can sign in is an
   env-var edit plus redeploy — no code change.
9. Under **Authentication → Email Templates → Magic Link**, replace the body
   so the email shows a **6-digit code** (required for local sign-in). Example:

   ```html
   <h2>Sign in to GreenThumb</h2>
   <p>Your code is <strong>{{ .Token }}</strong></p>
   <p>Enter this code in the app. It expires shortly and can only be used once.</p>
   ```

   Optional: also include a token-hash link that works across browsers:

   ```html
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Or sign in with this link</a></p>
   ```

   Do **not** use `{{ .ConfirmationURL }}` for local testing — that PKCE flow
   fails when the mail app opens a different browser (or prefetches the link).
10. Run `npm run db:migrate`. It creates the application tables and Drizzle's
   migration journal.

Admission is enforced server-side on the magic-link callback: a non-allowlisted
address is signed out immediately and cannot keep a session. Rejected attempts
are logged with the email and timestamp.

When the schema changes, edit `lib/db/schema.ts`, run `npm run db:generate`,
review the generated SQL under `lib/db/migrations`, and commit it.

## Data access and secrets

The garden profile and action log are hand-entered and effectively
irreplaceable, and the same environment holds keys that can spend money. Three
independent layers protect them, so that no single mistake exposes the data.

1. **Server-only access.** The browser talks only to this app's own routes.
   Every database read and write goes through a Server Component, server action,
   or route handler that checks the session first. Nothing in the browser holds
   a Supabase URL, key, or connection string — sign-in requests and verifies its
   one-time code through server actions rather than a browser Supabase client.
2. **Deny-by-default RLS.** Row Level Security is enabled on every table with no
   policy at all, and the PostgREST roles have no privileges in the `public`
   schema. A leaked anon key therefore returns zero rows. The application is
   unaffected because it connects as the role that owns the tables, and an owner
   is exempt from RLS. See `lib/db/migrations/0008_deny_by_default_rls.sql`.
3. **No secrets in the browser bundle.** `npm run verify:env` runs before
   `next build` and fails the build if a credential is prefixed `NEXT_PUBLIC_`
   or if a `"use client"` module can reach database, Supabase, or model-provider
   code through any chain of imports.

`NEXT_PUBLIC_` is the sharpest edge here: Next.js inlines those values into the
client bundle at build time, so the mistake publishes a secret silently and
cannot be fully undone — deployed bundles and CDN caches keep serving the value
until it is rotated.

### Secrets

Every secret is rotatable. After any rotation, update `.env.local` **and** the
Vercel environment variables, redeploy, and confirm `/health` still reports
`"database":"connected"`.

| Variable | Rotatable | How to rotate |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase → **Project Settings → Database → Reset database password**. Copy the new **Session pooler** URI. Every existing connection string stops working the moment it is reset, so update Vercel in the same sitting. |
| `SUPABASE_ANON_KEY` | Yes | Supabase → **Project Settings → API Keys**. Issue a new anon/publishable key, update it everywhere, then revoke the old one. Signed-in sessions may need to sign in again. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → **Project Settings → API Keys**. Issue a new service-role/secret key and revoke the old one. No application code uses this key, so rotating it cannot break the app. |
| `ANTHROPIC_API_KEY` | Yes | [console.anthropic.com](https://console.anthropic.com) → **API keys**. Create a new key, update it everywhere, then delete the old key. |
| `GEMINI_API_KEY` | Yes | [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Create a new key, update it everywhere, then delete the old key. |
| `GMAIL_APP_PASSWORD` | Yes | Google Account → **Security → App passwords**. Revoke the existing app password and generate a new one. It is per-application, so revoking affects only this app. |
| `CRON_SECRET` | Yes | Self-issued: `openssl rand -base64 32`. Update the Vercel variable and the GitHub Actions repository secret together, or the scheduled check-in starts failing with 401. |

`CRON_SECRET` and `SITE_URL` must also be GitHub Actions **repository secrets**
(Settings → Secrets and variables → Actions). They are not committed. `.env.example`
lists empty placeholders only.

`SUPABASE_URL`, `ALLOWED_EMAILS`, `SITE_URL`, and `LLM_PROVIDER` are not
credentials, but they stay server-only as well — nothing in the browser needs
them. Adding a secret to `SECRET_ENV_VARS` in `lib/security/secrets.ts` brings
it under every check above, so add it there and to this table together.

### Before a public deploy

Run these from a trusted checkout, with the same environment values the build
uses. The bundle scan needs the real values to prove anything, and it prints
only variable names and match lengths — never a secret — so its output is safe
to paste into an issue.

```sh
npm run build          # fails if a secret is NEXT_PUBLIC_ or reachable from the client
npm run verify:bundle  # searches the client-visible build output for secret fragments
npm run verify:rls     # proves the anon key alone returns zero rows from every table
```

`verify:bundle` reports which secrets were not set in the environment and
therefore not covered. If it finds a match, do not deploy: treat those secrets
as compromised, rotate them using the table above, remove whatever put the
value in the client bundle, and rebuild.

`npm run test:db` checks the same RLS guarantees from inside the database
(RLS enabled on every table, no policies, no privileges for the PostgREST
roles) and needs `DATABASE_URL`.

## Vercel deployment

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the
   detected Next.js settings.
3. Under **Environment Variables**, add `DATABASE_URL` and the other values from
   `.env.example`. Never create public variants of secret values.
4. Make `main` the production branch and deploy. Vercel automatically deploys
   future pushes to `main` and creates preview deployments for other branches.
5. Open `<deployment-url>/health` and confirm it returns `"status":"ok"`,
   `"database":"connected"`, and the deployed `commitSha`.

Migrations are deliberate and are not run during `next build`. Apply them from
a trusted checkout with `npm run db:migrate` before deploying schema-dependent
code.

## Deployment problem we hit (and what we learned)

Production once served the UI while `/health` returned **503**
(`database: "unavailable"`). Magic-link OTP still worked against **Supabase
Auth**; the stall was the next write to **Postgres**. Vercel Hobby can kill
the function around 10 seconds, so the sign-in form looked frozen.

What actually fixed it:

1. **Use the Session pooler URI for `DATABASE_URL` on Vercel**, not the
   direct `db.<project>.supabase.co` host. Serverless functions on Vercel
   often cannot reach that direct host (IPv6 / network path). The pooler
   (`*.pooler.supabase.com`, user `postgres.<project-ref>`) is the path that
   works from both a laptop and a Function.
2. **Wake a paused free-tier database.** Supabase Hobby sleeps after
   inactivity. The daily GitHub Actions check-in (`/api/care/checkin`) is
   also the keep-alive. Sign-in now pings Postgres while the email is in
   flight so the first code entry is less likely to hit a cold instance.
3. **Fail fast in the app** (`connect_timeout`, bounded retries, a visible
   “database unavailable” message) instead of waiting until the platform
   kills the request.

Lesson: Auth and the application database are separate. A green sign-in
email does not prove `DATABASE_URL` is right. Treat `/health` as the
production smoke test after every env or host change.

## Daily matching check-in

`.github/workflows/checkin.yml` POSTs to `/api/care/checkin` every morning so
the Today list is already computed — it does not run the LLM agent loop.

- **Schedule:** `13:00 UTC` (`cron: 0 13 * * *`), which is **06:00** in
  `America/Los_Angeles` during PDT. GitHub Actions cron is UTC-only and does
  not follow DST, so during PST the same job fires at **05:00** garden-local.
  The offset and this caveat are documented in the workflow file.
- **Auth:** `Authorization: Bearer` using the `CRON_SECRET` repository secret
  (must match the Vercel env var).
- **Manual run:** Actions → **Daily matching check-in** → **Run workflow**
  (`workflow_dispatch`). A failed POST (missing secrets, HTTP 4xx/5xx) exits
  non-zero and shows as a red run in that history.
- **Supabase keep-alive:** this daily request also prevents the free-tier
  database from pausing after inactivity. Weekly `pg_dump` backups (ALL-28)
  are a separate job; they are not a substitute for this ping.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` includes the client-boundary and `NEXT_PUBLIC_` guards. The checks
that need real credentials or a database are separate: see
[Before a public deploy](#before-a-public-deploy).
