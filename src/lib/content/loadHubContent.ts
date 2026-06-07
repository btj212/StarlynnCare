import { tryPublicSupabaseClient } from "@/lib/supabase/server";

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

/**
 * Conservative render-time guard for stored hub HTML.
 *
 * Hub HTML is authored by the LLM generator (constrained tag set) and edited by
 * an authenticated admin in the TipTap tool, and is sanitized again on approval
 * — so this is defense-in-depth, not the primary control. It strips dangerous
 * elements, inline event handlers, and javascript:/data: URLs. If we ever need
 * to harden against a hostile author we'd add a real sanitizer (one dependency);
 * for an admin-only authorship model this targeted strip is sufficient.
 */
export function sanitizeHubHtml(html: string): string {
  return html
    .replace(
      /<(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(/<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*"(?:javascript|data):[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'(?:javascript|data):[^']*'/gi, "$1='#'");
}
