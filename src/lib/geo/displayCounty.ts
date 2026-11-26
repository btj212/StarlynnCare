/**
 * Display-layer county names. PA ingest left 73 publishable homes with a
 * null `county` and the name in `wa_county` (a WA directory column reused
 * as overflow). `Northumberlnd` is a stored typo for Northumberland.
 *
 * Do not write these back to the database from the site. A migration to
 * copy `wa_county` into `county` for PA and fix the typo is listed in the PR.
 */

const COUNTY_SPELLING: Record<string, string> = {
  northumberlnd: "Northumberland",
  "mc kean": "McKean",
  mckean: "McKean",
};

export type CountyFields = {
  county?: string | null;
  wa_county?: string | null;
  tx_county?: string | null;
};

function titleCounty(name: string): string {
  if (name === "McKean") return name;
  if (name.includes(" ")) {
    return name
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Strip a trailing "County", fix known typos, return the county name without the suffix. */
export function normalizeCountyName(raw: string | null | undefined): string | null {
  const trimmed = raw?.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  const withoutSuffix = trimmed.replace(/\s+county$/i, "").trim();
  if (!withoutSuffix) return null;
  const mapped = COUNTY_SPELLING[withoutSuffix.toLowerCase()];
  return mapped ?? titleCounty(withoutSuffix);
}

export function facilityCounty(fields: CountyFields): string | null {
  return (
    normalizeCountyName(fields.county) ??
    normalizeCountyName(fields.wa_county) ??
    normalizeCountyName(fields.tx_county)
  );
}
