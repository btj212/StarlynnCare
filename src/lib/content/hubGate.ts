/**
 * Pure, client-safe helpers for hub content: the deterministic numeric gate and
 * the render-time HTML guard. No DB, no model, no server-only imports — so this
 * module can be imported from both server actions and the admin editor client
 * component.
 *
 * The numeric gate (`verifyHubStats`) is the TypeScript twin of `verify_stats()`
 * in scrapers/generate_hub_content.py. Keep STAT_KEYS and the normalization in
 * lockstep with the Python gate — they must agree exactly, or a number that
 * passes generation could fail approval (or vice versa).
 */

/** Numeric metrics the prose may cite. Mirrors STAT_KEYS in generate_hub_content.py. */
export const STAT_KEYS = [
  "facility_count",
  "facilities_with_serious",
  "pct_with_serious",
  "total_beds",
] as const;

export type StatsSnapshot = Record<string, unknown>;

/**
 * Deterministic numeric gate: every <span data-stat="KEY">VALUE</span> in the
 * body must match the grounded value in the snapshot. Plain code, no model — this
 * is what lets a human approve prose without re-checking the numbers
 * (CLAUDE.md Rule 5 / Data Accuracy). Returns a list of human-readable issues;
 * empty list means the body is number-clean.
 *
 * Mirrors the Python gate: strip inner tags (≈ BeautifulSoup get_text()), then
 * drop commas / % / whitespace (≈ re.sub(r"[,%\s]", "")) before comparing as
 * strings against String(snapshot[key]).
 */
export function verifyHubStats(
  bodyHtml: string,
  snapshot: StatsSnapshot,
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  const spanRe =
    /<span\b[^>]*\bdata-stat\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(bodyHtml)) !== null) {
    const key = m[1];
    seen.add(key);
    if (!(STAT_KEYS as readonly string[]).includes(key)) {
      issues.push(`Unknown data-stat key '${key}'.`);
      continue;
    }
    const shownText = m[2].replace(/<[^>]*>/g, "").trim();
    const shown = shownText.replace(/[,%\s]/g, "");
    const expected = String(snapshot[key]);
    if (shown !== expected) {
      issues.push(
        `data-stat '${key}' shows '${shownText}' but snapshot says '${expected}'.`,
      );
    }
  }
  if (!seen.has("facility_count")) {
    issues.push(
      "Body does not cite facility_count (must ground in the facility total).",
    );
  }
  return issues;
}

/**
 * Conservative render-time guard for stored hub HTML.
 *
 * Hub HTML is authored by the LLM generator (constrained tag set) and edited by
 * an authenticated admin in the source editor, and is sanitized again on save —
 * so this is defense-in-depth, not the primary control. It strips dangerous
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
