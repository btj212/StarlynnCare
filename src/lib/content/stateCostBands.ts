/**
 * Centralized state-level cost bands for memory care.
 *
 * Used by:
 *   - city/county hub page body (§ Cost section)
 *   - cityFaqs.getStateStrings (cost FAQ answer)
 *
 * Source: regional benchmarks from Genworth Cost of Care + operator surveys, refreshed
 * annually. These are PLANNING ESTIMATES — every facility profile shows the operator's
 * actual quote when known. Refresh dates appear on profiles via DataFootnote.
 *
 * When adding a new state, add an entry here AND ensure cityFaqs.getStateStrings has
 * a matching state branch that uses these bands consistently.
 */

export interface StateCostBand {
  /** Lower bound of typical monthly memory-care rent for that state (number, USD). */
  cityLow: number;
  /** Upper bound of typical monthly memory-care rent for that state. */
  cityHigh: number;
  /** Lower bound for county-wide ranges (typically wider than city bands). */
  countyLow: number;
  /** Upper bound for county-wide ranges. */
  countyHigh: number;
  /** Year the benchmark was last refreshed. */
  source: string;
}

const COST_BANDS: Record<string, StateCostBand> = {
  CA: {
    cityLow: 5000,
    cityHigh: 9000,
    countyLow: 4500,
    countyHigh: 12000,
    source: "Genworth 2024 + StarlynnCare operator survey",
  },
  TX: {
    cityLow: 4500,
    cityHigh: 7500,
    countyLow: 4500,
    countyHigh: 8500,
    source: "Genworth 2024 + Texas HHSC public rate data",
  },
  OR: {
    cityLow: 4500,
    cityHigh: 8500,
    countyLow: 4000,
    countyHigh: 9000,
    source: "Genworth 2024 + Oregon DHS rate guidance",
  },
  WA: {
    cityLow: 5500,
    cityHigh: 9500,
    countyLow: 5000,
    countyHigh: 10000,
    source: "Genworth 2024 + Washington DSHS rate guidance",
  },
  MN: {
    cityLow: 4500,
    cityHigh: 8500,
    countyLow: 4500,
    countyHigh: 9000,
    source: "Genworth 2024 + Minnesota DHS rate guidance",
  },
  PA: {
    cityLow: 4500,
    cityHigh: 8000,
    countyLow: 4000,
    countyHigh: 8500,
    source: "Genworth 2024 + PA DHS OLTL rate guidance",
  },
  IL: {
    cityLow: 4500,
    cityHigh: 8500,
    countyLow: 4000,
    countyHigh: 9000,
    source: "Genworth 2024 + IDPH regional benchmarks",
  },
  UT: {
    cityLow: 4000,
    cityHigh: 7500,
    countyLow: 3800,
    countyHigh: 8000,
    source: "Genworth 2024 + Utah DLBC rate guidance",
  },
};

const FALLBACK: StateCostBand = {
  cityLow: 4500,
  cityHigh: 9000,
  countyLow: 4000,
  countyHigh: 10000,
  source: "Genworth 2024 regional benchmark",
};

export function getStateCostBand(stateCode: string): StateCostBand {
  return COST_BANDS[stateCode.toUpperCase()] ?? FALLBACK;
}

/** Format a number as `$X,XXX` (no decimals). */
export function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** Returns the rendered range string for a city or county hub, e.g. `$5,000–$9,000/month`. */
export function formatCostRange(
  stateCode: string,
  scope: "city" | "county",
): string {
  const band = getStateCostBand(stateCode);
  const lo = scope === "city" ? band.cityLow : band.countyLow;
  const hi = scope === "city" ? band.cityHigh : band.countyHigh;
  return `${formatCurrency(lo)}\u2013${formatCurrency(hi)}/month`;
}
