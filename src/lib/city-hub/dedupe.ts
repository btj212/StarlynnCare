import { formatFacilityName } from "@/lib/facility/displayName";

function normalizeDisplayName(name: string): string {
  return formatFacilityName(name)
    .toLowerCase()
    .replace(/,?\s+(llc|llp|pllc|inc\.?|ltd\.?|pc)\.?$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type DedupeHome = {
  id: string;
  name: string;
  inspections: number;
  total_citations: number;
  zip?: string | null;
};

/**
 * Collapse same-name rows at the same ZIP at display time. Prefer the home
 * with more inspections, then more citations, then a stable id. Does not write
 * the DB. Different licenses that share a marketing-style name in different
 * ZIPs stay listed.
 */
/**
 * Homes a hub page actually prints. Pennsylvania collapses same-name rows
 * at the same ZIP. Every other state lists each publishable home once.
 * The count of this list is the number the headline may quote.
 */
export function quoteHomesOnPage<T extends DedupeHome>(homes: T[], stateCode: string): T[] {
  return stateCode === "PA" ? dedupeHomesByDisplayName(homes) : homes;
}

export function dedupeHomesByDisplayName<T extends DedupeHome>(homes: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const home of homes) {
    const nameKey = normalizeDisplayName(home.name);
    if (!nameKey) continue;
    const zip = (home.zip ?? "").trim().slice(0, 5);
    const key = `${nameKey}|${zip}`;
    const list = groups.get(key);
    if (list) list.push(home);
    else groups.set(key, [home]);
  }

  const kept = new Set<string>();
  for (const list of groups.values()) {
    const winner = [...list].sort((a, b) => {
      if (b.inspections !== a.inspections) return b.inspections - a.inspections;
      if (b.total_citations !== a.total_citations) return b.total_citations - a.total_citations;
      return a.id.localeCompare(b.id);
    })[0];
    if (winner) kept.add(winner.id);
  }

  return homes.filter((home) => kept.has(home.id) || !normalizeDisplayName(home.name));
}
