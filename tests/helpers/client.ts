/**
 * Shared Supabase clients for integration tests.
 *
 * Creates clients directly from environment variables rather than going
 * through @/lib/supabase/server so tests are not coupled to the Next.js
 * cookie context.  The underlying @supabase/supabase-js calls are identical
 * to what the app makes in production.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function url(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return u;
}

function publishableKey(): string {
  const k =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!k)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set",
    );
  return k;
}

function serviceKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return k;
}

/** Anon/public client — same RLS access the website uses for reads. */
export function publicClient(): SupabaseClient {
  return createClient(url(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client — bypasses RLS.
 * Required for: inserting test data, reading pending reviews, cleanup.
 */
export function serviceRoleClient(): SupabaseClient {
  return createClient(url(), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Returns true when the Supabase env vars are missing so individual tests
 * can call `test.skipIf(SKIP)('…', …)` instead of hard-failing.
 */
export function isUnconfigured(): boolean {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !u || !k;
}

/**
 * Returns true when service-role key is also absent
 * (write-path tests need this).
 */
export function isServiceUnconfigured(): boolean {
  return isUnconfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}
