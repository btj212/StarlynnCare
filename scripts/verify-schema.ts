/**
 * Verifies Supabase connectivity and table access after running 0001_init.sql.
 *
 * - Anon key: must read states, facilities, inspections, deficiencies (RLS allows SELECT).
 * - Service role: must read scrape_runs, content_runs (no public SELECT policy on those tables).
 *
 * Usage: copy `.env.local.example` → `.env.local`, fill keys, then:
 *   npm run verify-schema
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is missing in .env.local");
  if (!anon) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env.local");

  const publicClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const publicTables = [
    "states",
    "facilities",
    "inspections",
    "deficiencies",
  ] as const;

  console.log("Checking public (anon) SELECT on RLS-readable tables…");
  for (const table of publicTables) {
    const { error, count } = await publicClient
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      fail(`${table}: ${error.message}`);
    }
    console.log(`  ✓ ${table} (rows: ${count ?? "?"})`);
  }

  const { count: stateCount } = await publicClient
    .from("states")
    .select("*", { count: "exact", head: true });
  if (stateCount !== 50) {
    console.warn(`  ⚠ Expected 50 states after seed, got ${stateCount}`);
  }

  if (!service) {
    console.warn(
      "\n⚠ SUPABASE_SERVICE_ROLE_KEY not set — skipping scrape_runs / content_runs checks.",
    );
    console.log("\n✅ Anon checks passed.");
    return;
  }

  const serviceClient = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const privateTables = ["scrape_runs", "content_runs"] as const;
  console.log("\nChecking service role SELECT on internal tables…");
  for (const table of privateTables) {
    const { error, count } = await serviceClient
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) fail(`${table}: ${error.message}`);
    console.log(`  ✓ ${table} (rows: ${count ?? 0})`);
  }

  console.log("\n✅ All checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
