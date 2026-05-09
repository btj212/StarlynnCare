/**
 * Clip meta descriptions for `<meta name="description">` and matching OG/Twitter fields.
 * Prefer sentence boundaries; otherwise word boundaries; keeps length ≤ `max` including ellipsis.
 * Abbreviations (single capital letter + period, e.g. "St.", "Dr.", "Mt.") are never treated
 * as sentence boundaries, preventing truncation mid-city-name like "…in St.…".
 */
export function clipMetaDescription(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t;

  const ellipsis = "…";
  const budget = max - ellipsis.length;
  const slice = t.slice(0, budget);
  const preferFrom = Math.floor(max * 0.6);

  // Last sentence end within slice, not before preferFrom.
  // Skip periods that are preceded by an abbreviation (e.g. "N.", "St.", "Dr.", "Mt.").
  for (let i = slice.length - 1; i >= preferFrom; i--) {
    const c = slice[i];
    if (c === "." || c === "!" || c === "?") {
      const next = slice[i + 1];
      if (next === undefined || /\s/.test(next ?? "")) {
        const prev = i > 0 ? slice[i - 1] : "";
        const prevPrev = i > 1 ? slice[i - 2] : "";
        const prevPrevPrev = i > 2 ? slice[i - 3] : "";
        // Single uppercase: "N.", "A.", "U.", etc.
        const isSingleUpperAbbrev =
          /[A-Z]/.test(prev) && (prevPrev === "" || /[\s\-]/.test(prevPrev));
        // Two-letter uppercase-initial: "St.", "Dr.", "Mt.", "Rd.", "Jr.", "Sr.", etc.
        const isTwoLetterAbbrev =
          /[a-z]/.test(prev) &&
          /[A-Z]/.test(prevPrev) &&
          (prevPrevPrev === "" || /[\s\-]/.test(prevPrevPrev));
        const isAbbreviation = isSingleUpperAbbrev || isTwoLetterAbbrev;
        if (isAbbreviation) continue;
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
