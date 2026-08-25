-- Deny-by-default Row Level Security (ALL-16).
--
-- Server-only access is the primary control: the browser talks to this app's own
-- routes, and only server code holds DATABASE_URL. This migration is the
-- backstop underneath it, so that someone arriving with the anon key — or a
-- leaked one — gets nothing rather than the whole garden.
--
-- Two independent layers:
--   1. RLS enabled on every table with no policy at all. No policy means no row
--      qualifies, so the answer is zero rows rather than "everything".
--   2. Table privileges revoked from Supabase's PostgREST roles, so the request
--      is refused before RLS is even consulted.
--
-- The application is unaffected. It connects over DATABASE_URL as the role that
-- owns these tables, and an owner is exempt from RLS unless FORCE ROW LEVEL
-- SECURITY is set. FORCE is deliberately not used: it would lock out the app
-- itself, and the deny it adds only covers the role that already has
-- DATABASE_URL.
--
-- Every table is enabled by iterating the catalog rather than by listing names,
-- so this cannot silently miss one. A table added later must enable RLS in its
-- own migration; `lib/db/rls.integration.test.ts` fails if one does not.
DO $$
DECLARE
  target regclass;
BEGIN
  FOR target IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END
$$;--> statement-breakpoint
-- A view reads with its owner's privileges by default, which would see straight
-- past the RLS above. security_invoker makes it evaluate as the calling role.
ALTER VIEW "public"."current_location" SET (security_invoker = true);--> statement-breakpoint
-- anon and authenticated are Supabase's PostgREST roles and do not exist on a
-- plain Postgres, so each revoke is guarded on the role being present.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format(
        'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format(
        'REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM %I', api_role);

      -- Without this, the next table created in this schema would be granted
      -- straight back to the PostgREST roles. Default privileges are keyed on
      -- the role that creates the object, so this covers the role running
      -- migrations. Supabase keeps a second set under supabase_admin that we
      -- are not a member of; it never creates our tables, so it never applies
      -- to them.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        api_role);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        api_role);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM %I',
        api_role);
    END IF;
  END LOOP;
END
$$;
