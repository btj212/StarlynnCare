/**
 * Listed prices from third-party sites, shown as bands.
 *
 * A band always contains every real figure behind it and is at least $1,000 wide.
 * Its edges sit on a $500 grid and never on a figure we read, so no site's exact
 * number appears on a StarlynnCare page. The same input always gives the same
 * band. The figure is never moved at random: a shifted number shown as a home's
 * price would be invented data.
 *
 * Memory care costs more than assisted living, so the two are never mixed.
 */

import { linkableFacilityUrl } from "@/lib/facility/aggregatorLink";

const STEP = 500;
const MIN_WIDTH = 1000;
/** A city range needs this many homes with a labeled memory care price. */
export const MIN_HOMES_FOR_CITY_BAND = 5;

export type CostRow = {
  facility_id: string;
  source: string;
  source_url: string | null;
  fetched_at: string;
  /** Lowest private-room price on the page. */
  entry_price: number | null;
  /** Set only when the page labels the price as memory care. */
  memory_care_price: number | null;
  care_basis: string | null;
};

export type PriceBand = { low: number; high: number };

export type HomeCost = {
  kind: "memory_care" | "assisted_living";
  band: PriceBand;
  sources: { label: string; url: string | null }[];
  /** Most recent fetch date among the sources, YYYY-MM-DD. */
  checked: string;
};

const SOURCE_LABEL: Record<string, string> = {
  caring: "Caring.com",
  apfm: "A Place for Mom",
  senioradvisor: "SeniorAdvisor",
};

export function priceBand(values: number[]): PriceBand | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Strictly below and above, so a figure on the grid is not an edge.
  const low = Math.floor((min - 1) / STEP) * STEP;
  const high = Math.max(Math.ceil((max + 1) / STEP) * STEP, low + MIN_WIDTH);
  return { low, high };
}

export function memoryCareValue(row: CostRow): number | null {
  if (row.memory_care_price != null) return row.memory_care_price;
  return row.care_basis === "memory_care" ? row.entry_price : null;
}

function assistedLivingValue(row: CostRow): number | null {
  return row.care_basis === "memory_care" ? null : row.entry_price;
}

function build(
  kind: HomeCost["kind"],
  rows: CostRow[],
  pick: (row: CostRow) => number | null,
): HomeCost | null {
  const used = rows.filter((row) => pick(row) != null);
  const band = priceBand(used.map((row) => pick(row) as number));
  if (!band) return null;
  return {
    kind,
    band,
    sources: used.map((row) => ({
      label: SOURCE_LABEL[row.source] ?? row.source,
      url: linkableFacilityUrl(row.source_url),
    })),
    checked: used.map((row) => row.fetched_at.slice(0, 10)).sort().at(-1) ?? "",
  };
}

/** Memory care when any source labels it. Otherwise assisted living. Otherwise nothing. */
export function summarizeHomeCost(rows: CostRow[]): HomeCost | null {
  return build("memory_care", rows, memoryCareValue) ?? build("assisted_living", rows, assistedLivingValue);
}

function percentile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * The middle half of homes with a labeled memory care price, as a band.
 * Null under MIN_HOMES_FOR_CITY_BAND homes: too few to call a city range.
 */
export function cityMemoryCareBand(rows: CostRow[]): { band: PriceBand; homes: number } | null {
  const perHome = new Map<string, number>();
  for (const row of rows) {
    const value = memoryCareValue(row);
    if (value == null) continue;
    // One value per home: the lowest labeled memory care price across its sources.
    perHome.set(row.facility_id, Math.min(value, perHome.get(row.facility_id) ?? value));
  }
  if (perHome.size < MIN_HOMES_FOR_CITY_BAND) return null;
  const sorted = [...perHome.values()].sort((a, b) => a - b);
  const band = priceBand([percentile(sorted, 0.25), percentile(sorted, 0.75)]);
  return band ? { band, homes: perHome.size } : null;
}
