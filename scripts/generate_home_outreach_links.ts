/**
 * Signed per-facility confirm links for outreach email.
 *
 * Usage:
 *   npx tsx scripts/generate_home_outreach_links.ts --state AZ
 *   npx tsx scripts/generate_home_outreach_links.ts --state AZ --limit 20 --out /tmp/az-outreach.csv
 *
 * Requires HOME_OUTREACH_SECRET and Supabase keys in .env.local.
 * Does not send email. Does not write the database.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalFor } from "../src/lib/seo/canonical.ts";
import { signOutreachToken } from "../src/lib/facility/homeOutreach.ts";
import { stateFromCode } from "../src/lib/states.ts";

config({ path: path.resolve(process.cwd(), ".env.local") });

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const stateCode = (arg("state") ?? "").toUpperCase();
  const limitRaw = arg("limit");
  const out = arg("out");
  if (!stateCode) fail("Pass --state AZ (or another state code).");
  const state = stateFromCode(stateCode);
  if (!state) fail(`Unknown state code ${stateCode}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) fail("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in .env.local");
  if (!process.env.HOME_OUTREACH_SECRET?.trim()) {
    fail("HOME_OUTREACH_SECRET is not set. openssl rand -base64 32, then add it to .env.local (do not commit it).");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let query = supabase
    .from("facilities")
    .select("id, name, city, slug, city_slug, website, phone, phone_override")
    .eq("state_code", stateCode)
    .eq("publishable", true)
    .order("city")
    .order("name");
  const limit = limitRaw ? Number(limitRaw) : null;
  if (limit && Number.isInteger(limit) && limit > 0) query = query.limit(limit);

  const { data, error } = await query;
  if (error) fail(error.message);
  const rows = data ?? [];

  const header = "facility_id,name,city,url";
  const lines = [header];
  for (const row of rows) {
    const token = signOutreachToken(row.id);
    const pathName = `/${state.slug}/${row.city_slug}/${row.slug}/confirm`;
    const href = `${canonicalFor(pathName)}?t=${encodeURIComponent(token)}`;
    const csv = [row.id, csvCell(row.name), csvCell(row.city ?? ""), csvCell(href)].join(",");
    lines.push(csv);
  }

  const body = `${lines.join("\n")}\n`;
  if (out) {
    writeFileSync(out, body);
    console.error(`Wrote ${rows.length} links to ${out}`);
  } else {
    process.stdout.write(body);
  }
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
