/**
 * Proves the deny from where an attacker would stand: the anon key alone,
 * against Supabase's REST API, with no session. Every table must answer with
 * zero rows or refuse the request outright.
 *
 * `lib/db/rls.integration.test.ts` checks the same thing from inside the
 * database. This script is the outside view, and needs only the anon key —
 * so it is also what to run after rotating that key.
 */
import { PUBLIC_TABLE_NAMES, PUBLIC_VIEW_NAMES } from "../lib/db/table-names";

type Outcome =
  | { relation: string; verdict: "denied"; detail: string }
  | { relation: string; verdict: "exposed"; detail: string };

/** PostgREST refuses the request itself rather than returning an empty set. */
const REFUSED_STATUSES = new Set([401, 403, 404, 406]);

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");

  await assertKeyIsUsable(supabaseUrl, anonKey);

  const relations = [...PUBLIC_TABLE_NAMES, ...PUBLIC_VIEW_NAMES];
  const outcomes: Outcome[] = [];

  for (const relation of relations) {
    outcomes.push(await readWithAnonKey(supabaseUrl, anonKey, relation));
  }

  for (const outcome of outcomes) {
    const label = outcome.verdict === "denied" ? "denied " : "EXPOSED";
    console.log(`${label} ${outcome.relation.padEnd(18)} ${outcome.detail}`);
  }

  const exposed = outcomes.filter(({ verdict }) => verdict === "exposed");

  if (exposed.length > 0) {
    console.error(
      `\n${exposed.length} of ${relations.length} relations returned data to the anon key.` +
        "\nRow Level Security is not doing its job. Confirm migration 0008 was" +
        "\napplied to this project, and that no policy has been added since.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nAll ${relations.length} relations returned zero rows to the anon key alone.`,
  );
}

/**
 * A wrong or revoked key is refused on every table too, which would look
 * identical to a successful deny. The auth settings endpoint accepts any valid
 * anon key regardless of database privileges, so a 200 here is what makes the
 * refusals below meaningful rather than vacuous.
 */
async function assertKeyIsUsable(supabaseUrl: string, anonKey: string) {
  const response = await fetch(new URL("/auth/v1/settings", supabaseUrl), {
    headers: { apikey: anonKey },
  });

  if (!response.ok) {
    throw new Error(
      `SUPABASE_ANON_KEY was refused by this project (HTTP ${response.status}).\n` +
        "Every table would then refuse it too, which would pass this check\n" +
        "without proving anything. Fix the key or SUPABASE_URL and re-run.",
    );
  }

  console.log("SUPABASE_ANON_KEY is valid for this project; testing each relation.\n");
}

async function readWithAnonKey(
  supabaseUrl: string,
  anonKey: string,
  relation: string,
): Promise<Outcome> {
  const endpoint = new URL(`/rest/v1/${relation}`, supabaseUrl);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      accept: "application/json",
    },
  });

  if (REFUSED_STATUSES.has(response.status)) {
    return {
      relation,
      verdict: "denied",
      detail: `request refused with HTTP ${response.status}`,
    };
  }

  if (!response.ok) {
    return {
      relation,
      verdict: "exposed",
      detail: `unexpected HTTP ${response.status}; could not prove a deny`,
    };
  }

  const body: unknown = await response.json();

  if (!Array.isArray(body)) {
    return {
      relation,
      verdict: "exposed",
      detail: "response was not a row array; could not prove a deny",
    };
  }

  return body.length === 0
    ? { relation, verdict: "denied", detail: "HTTP 200 with zero rows" }
    : {
        relation,
        verdict: "exposed",
        detail: `HTTP 200 returned ${body.length} row(s)`,
      };
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} must be set to verify Row Level Security`);
  }

  return value.trim();
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
