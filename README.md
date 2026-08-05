# GreenThumb

GreenThumb is a mobile-first garden-care app for one household. This repository
uses Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM,
Supabase Postgres, and Vercel.

## Live app

[green-thumb-orpin.vercel.app](https://green-thumb-orpin.vercel.app)

## Local setup

Prerequisites:

- Node.js 22 or newer
- npm
- A Supabase project (only `DATABASE_URL` is needed to run this skeleton)

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

4. Apply every checked-in migration with one command:

   ```sh
   npm run db:migrate
   ```

5. Start the app:

   ```sh
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000). The database health
   response is at [http://localhost:3000/health](http://localhost:3000/health).

Only server modules access Postgres. Do not add `NEXT_PUBLIC_` to database,
Supabase service-role, model, email, or cron credentials.

## Supabase setup

1. Create a project at [database.new](https://database.new) on the free plan.
2. Save the generated database password in a password manager.
3. Copy the **Session pooler** connection URI into `DATABASE_URL`.
4. Open **Project Settings → API Keys** and copy the service-role key into
   `SUPABASE_SERVICE_ROLE_KEY`. This skeleton does not use that key yet, but
   later server-side auth work will.
5. Run `npm run db:migrate`. It creates the trivial `app_metadata` table and
   Drizzle's migration journal, proving the migration path end to end.

When the schema changes, edit `lib/db/schema.ts`, run `npm run db:generate`,
review the generated SQL under `lib/db/migrations`, and commit it.

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
6. Replace the placeholder in **Live app** above with the production URL.

Migrations are deliberate and are not run during `next build`. Apply them from
a trusted checkout with `npm run db:migrate` before deploying schema-dependent
code.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
```
