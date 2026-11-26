/**
 * DBA / marketing-name hook.
 *
 * Legal license names often differ from the name families search
 * ("Legacy House of Mesa" vs "Legacy Retirement Residence"). Do not
 * invent aliases. Read a sourced marketing name when the data layer
 * has one; otherwise return nothing and leave the legal name in place.
 *
 * Preferred column (migration 0077, apply before filling):
 *   facilities.marketing_name, facilities.name_aliases
 * Deploy-safe fallback that already exists:
 *   facilities.content.marketing_name, facilities.content.name_aliases
 */

import { formatFacilityName } from "@/lib/facility/displayName";

export type AliasSource = {
  name?: string | null;
  marketing_name?: string | null;
  name_aliases?: string[] | null;
  content?: {
    marketing_name?: string | null;
    name_aliases?: string[] | null;
  } | null;
};

export type FacilityAliases = {
  /** Consumer-facing name when it differs from the legal license name. */
  marketingName: string | null;
  /** Extra search aliases (former names, chain names). */
  aliases: string[];
  /** Names that should match a type-ahead or city-list search. */
  searchNames: string[];
};

function cleanName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function uniqueNames(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = cleanName(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

export function facilityAliases(facility: AliasSource): FacilityAliases {
  const legal = cleanName(facility.name);
  const marketing = cleanName(facility.marketing_name) ?? cleanName(facility.content?.marketing_name);
  const extra = [
    ...(facility.name_aliases ?? []),
    ...(facility.content?.name_aliases ?? []),
  ];

  const marketingName =
    marketing && (!legal || marketing.toLowerCase() !== legal.toLowerCase())
      ? marketing
      : null;

  const aliases = uniqueNames(
    extra.filter((alias) => {
      const cleaned = cleanName(alias);
      if (!cleaned) return false;
      if (legal && cleaned.toLowerCase() === legal.toLowerCase()) return false;
      if (marketingName && cleaned.toLowerCase() === marketingName.toLowerCase()) return false;
      return true;
    }),
  );

  return {
    marketingName,
    aliases,
    searchNames: uniqueNames([legal, marketingName, ...aliases]),
  };
}

/** Display name: sourced marketing name, else formatted legal name. */
export function facilityDisplayName(facility: AliasSource): string {
  const aliases = facilityAliases(facility);
  if (aliases.marketingName) return formatFacilityName(aliases.marketingName);
  return formatFacilityName(facility.name);
}

/** Read alias fields from facilities.content without inventing values. */
export function contentAliasFields(content: unknown): {
  marketing_name: string | null;
  name_aliases: string[] | null;
} {
  if (!content || typeof content !== "object") {
    return { marketing_name: null, name_aliases: null };
  }
  const row = content as { marketing_name?: unknown; name_aliases?: unknown };
  return {
    marketing_name: typeof row.marketing_name === "string" ? row.marketing_name : null,
    name_aliases: Array.isArray(row.name_aliases)
      ? row.name_aliases.filter((value): value is string => typeof value === "string")
      : null,
  };
}

export function nameMatchesQuery(facility: AliasSource, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return true;
  return facilityAliases(facility).searchNames.some((name) => {
    const formatted = formatFacilityName(name).toLowerCase();
    return name.toLowerCase().includes(needle) || formatted.includes(needle);
  });
}
