/**
 * Display-time facility / operator name formatting.
 *
 * Regulator source data often stores leading articles inverted
 * ("Lakes, the" → should read "The Lakes") and all-caps rows
 * ("OAKS, THE"). Format at render — never mutate facilities.name
 * in the DB, because slugs are derived from the stored name at ingest.
 */

const STOP_WORDS = new Set([
  "and",
  "or",
  "of",
  "in",
  "the",
  "a",
  "an",
  "at",
  "by",
  "for",
  "to",
  "de",
  "del",
  "las",
  "los",
  "el",
  "la",
  "&",
]);

const ARTICLE_SUFFIX = /^(.+?),\s*(the|a|an)\s*$/i;

const SUFFIX_FIXES: Array<[RegExp, string]> = [
  [/\bLlc\b/g, "LLC"],
  [/\bLlp\b/g, "LLP"],
  [/\bInc\b\.?/g, "Inc."],
  [/\bLtd\b\.?/g, "Ltd."],
  [/\bIi\b/g, "II"],
  [/\bIii\b/g, "III"],
  [/\bIv\b/g, "IV"],
];

function isAllUppercase(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

function titleize(text: string): string {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => (i > 0 && STOP_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function fixSuffixes(text: string): string {
  let out = text;
  for (const [re, replacement] of SUFFIX_FIXES) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Format a facility or operator name for display.
 * Safe to call on already-formatted names (idempotent for normal cases).
 */
export function formatFacilityName(
  name: string | null | undefined,
): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  let working = trimmed;
  let article: string | null = null;

  const match = working.match(ARTICLE_SUFFIX);
  if (match) {
    working = match[1].trim();
    article = match[2].toLowerCase();
  }

  if (isAllUppercase(working) || (article && isAllUppercase(trimmed))) {
    working = titleize(working);
  }

  working = fixSuffixes(working);

  if (article) {
    const prefixed = article.charAt(0).toUpperCase() + article.slice(1);
    return `${prefixed} ${working}`;
  }

  return working;
}
