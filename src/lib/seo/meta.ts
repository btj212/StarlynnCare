/**
 * Clip meta descriptions for `<meta name="description">` and matching OG/Twitter fields.
 * Prefer sentence boundaries; otherwise word boundaries; keeps length ≤ `max` including ellipsis.
 */
export function clipMetaDescription(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t;

  const ellipsis = "…";
  const budget = max - ellipsis.length;
  const slice = t.slice(0, budget);
  const preferFrom = Math.floor(max * 0.6);

  // Last sentence end within slice, not before preferFrom
  for (let i = slice.length - 1; i >= preferFrom; i--) {
    const c = slice[i];
    if (c === "." || c === "!" || c === "?") {
      const next = slice[i + 1];
      if (next === undefined || /\s/.test(next ?? "")) {
        const out = slice.slice(0, i + 1).trim();
        if (out.length > 0 && out.length <= budget) return out + ellipsis;
      }
    }
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > preferFrom && lastSpace > 0) {
    return slice.slice(0, lastSpace).trim() + ellipsis;
  }

  return slice.trim() + ellipsis;
}
