import type { StatItem } from "@/components/editorial/StatBlock";
import type { StateHubData } from "@/lib/data/stateHub";

export type EditorialCard = {
  kind: string;
  title: string;
  desc: string;
  meta: string;
  href: string | null;
  live: boolean;
};

export interface StateHubConfig {
  stateSlug: string;
  stateCode: string;
  stateName: string;
  /** Hero volume label e.g. "Vol. 01". */
  edition: string;
  /** Methodology steps (state-specific regulator language). */
  methodologySteps: ReadonlyArray<{ n: string; t: string; p: string }>;
  /** Editorial article cards for § 04. */
  editorialCards: EditorialCard[];
  /** County names to show as "coming soon" in the browse grid. */
  comingCounties: readonly string[];
  /** FAQ set for § 06. */
  faqs: FaqItem[];
  /** Primary regulator abbreviation: "CDSS", "Oregon DHS", "DSHS", "MDH", "HHSC". */
  regulatorAbbr: string;
  /** Secondary source label for inspection counts. */
  inspectionSrc: string;
  /** Whether the ZIP search form is shown on the hub's hero. */
  showZipSearch: boolean;
}

export interface FaqItem {
  q: string;
  a: string;
}

/** Builds the standard 4 stat items for a state hub. */
export function buildStateStatItems(
  stats: StateHubData["stats"],
  config: StateHubConfig,
): StatItem[] {
  const { stateName, regulatorAbbr, inspectionSrc } = config;
  return [
    {
      n: stats.facilities > 0 ? stats.facilities.toLocaleString() : "0",
      label: `Licensed memory care facilities indexed across ${stateName}`,
      src: regulatorAbbr,
    },
    {
      n: stats.inspections > 0 ? stats.inspections.toLocaleString() : "0",
      label: "State inspection reports, parsed and dated",
      src: inspectionSrc,
      delta: "Updated regularly",
    },
    {
      n: stats.severeCitations > 0 ? stats.severeCitations.toLocaleString() : "0",
      label: "Severe deficiencies on file in the last 24 months",
      src: regulatorAbbr,
    },
    {
      n: "0",
      label: "Referral commissions, lead fees, or paid placements accepted from operators",
      src: "Policy",
      delta: "Since day one",
    },
  ];
}
