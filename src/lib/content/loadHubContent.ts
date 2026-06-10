import { tryPublicSupabaseClient } from "@/lib/supabase/server";

// Render-time HTML guard lives in the pure, client-safe hubGate module so the
// admin editor (a Client Component) can reuse it without pulling in server-only
// code. Re-exported here for existing call sites (e.g. the city page).
export { sanitizeHubHtml } from "@/lib/content/hubGate";

export type PublishedHubContent = {
  title: string | null;
  bodyHtml: string;
};

/**
 * Load the live editorial body for a hub region, if one exists.
 *
 * Reads through the publishable (anon) client, so the `hub_content` RLS policy
 * (`status = 'published' AND drift_detected = false`) does the gating: a draft,
 * an in-review row, or a row flagged by the drift audit is invisible here and
 * the caller falls back to the hand-authored intro. That fallback is the
 * auto-suppress guarantee — a stale number can never render.
 */
export async function loadPublishedHubContent(
  stateCode: string,
  regionSlug: string,
): Promise<PublishedHubContent | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("hub_content")
    .select("title, body_html")
    .eq("state_code", stateCode.toUpperCase())
    .eq("region_slug", regionSlug)
    .maybeSingle();

  if (error || !data || !data.body_html) return null;
  return { title: data.title ?? null, bodyHtml: data.body_html };
}
