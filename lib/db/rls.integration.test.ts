import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { PUBLIC_TABLE_NAMES } from "./table-names";

const runDatabaseTests = process.env.RUN_DB_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const databaseUrl = process.env.DATABASE_URL;
const client =
  runDatabaseTests && databaseUrl
    ? postgres(databaseUrl, { max: 1, prepare: false })
    : undefined;

/** Supabase's PostgREST roles: who an anon or user JWT actually connects as. */
const API_ROLES = ["anon", "authenticated"];

/** Postgres `insufficient_privilege`. */
const PERMISSION_DENIED = "42501";

async function apiRolesPresent() {
  const roles = await client!<{ rolname: string }[]>`
    select rolname from pg_roles where rolname = any(${API_ROLES})
  `;

  return roles.length === API_ROLES.length;
}

/**
 * Reads one row as the anon role. Both revoked privileges and deny-by-default
 * RLS are passes; only those two outcomes are tolerated, so an unrelated failure
 * still fails the test instead of looking like a successful deny.
 */
async function readAsAnonRole(table: string) {
  try {
    return await client!.begin(async (transaction) => {
      await transaction`set local role anon`;
      return await transaction.unsafe(`select 1 from "${table}" limit 1`);
    });
  } catch (error) {
    if ((error as { code?: string }).code !== PERMISSION_DENIED) {
      throw error;
    }

    return [];
  }
}

describeDatabase("deny-by-default row level security", () => {
  afterAll(async () => {
    await client?.end();
  });

  it("enables row level security on every table in the public schema", async () => {
    const tables = await client!<
      { relname: string; relrowsecurity: boolean }[]
    >`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
      order by c.relname
    `;

    expect(tables.map(({ relname }) => relname)).toEqual(
      expect.arrayContaining([...PUBLIC_TABLE_NAMES]),
    );
    expect(
      tables
        .filter(({ relrowsecurity }) => !relrowsecurity)
        .map(({ relname }) => relname),
    ).toEqual([]);
  });

  it("grants no row to anyone through a policy", async () => {
    const policies = await client!<{ tablename: string; policyname: string }[]>`
      select tablename, policyname
      from pg_policies
      where schemaname = 'public'
      order by tablename, policyname
    `;

    // RLS with no policy denies every role it applies to. A policy here would
    // be the one thing that could hand rows back out, so there should be none.
    expect(policies).toEqual([]);
  });

  it("evaluates the current_location view as its caller, not its owner", async () => {
    const [view] = await client!<{ reloptions: string[] | null }[]>`
      select c.reloptions
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'current_location'
    `;

    expect(view?.reloptions ?? []).toContain("security_invoker=true");
  });

  it("leaves the PostgREST roles no privilege on anything in public", async () => {
    if (!(await apiRolesPresent())) {
      return;
    }

    const grants = await client!<
      { relname: string; grantee: string; privilege_type: string }[]
    >`
      select c.relname, acl.grantee::regrole::text as grantee, acl.privilege_type
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) acl
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'v', 'm')
        and acl.grantee::regrole::text = any(${API_ROLES})
      order by c.relname, grantee, privilege_type
    `;

    expect(grants).toEqual([]);
  });

  it("does not grant the next table created by this role to the PostgREST roles", async () => {
    if (!(await apiRolesPresent())) {
      return;
    }

    // Default privileges are keyed on the role that creates the object, and
    // migrations run as the role in DATABASE_URL. Supabase keeps its own
    // defaults under supabase_admin, which we are not a member of and cannot
    // change — but it never creates our tables, so those defaults never apply
    // to them. If something does slip through, the privileges test above fails.
    const defaults = await client!<
      { defaclobjtype: string; grantee: string; privilege_type: string }[]
    >`
      select d.defaclobjtype, acl.grantee::regrole::text as grantee, acl.privilege_type
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) acl
      where n.nspname = 'public'
        and d.defaclrole = current_user::regrole
        and acl.grantee::regrole::text = any(${API_ROLES})
      order by d.defaclobjtype, grantee, privilege_type
    `;

    expect(defaults).toEqual([]);
  });

  it("returns no rows to a session running as the anon role", async () => {
    if (!(await apiRolesPresent())) {
      return;
    }

    // The app's own role owns these tables and is exempt from RLS, so the deny
    // is only observable from a role the anon key would actually use.
    for (const table of PUBLIC_TABLE_NAMES) {
      expect(await readAsAnonRole(table), `anon read of ${table}`).toEqual([]);
    }
  });
});
