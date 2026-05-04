import type { StatItem } from "@/components/editorial/StatBlock";
import type { CaliforniaStateHubData } from "@/lib/data/stateHub";

export type EditorialCard = {
  kind: string;
  title: string;
  desc: string;
  meta: string;
  href: string | null;
  live: boolean;
};

export const COMING_COUNTIES: string[] = [];

export const CALIFORNIA_EDITORIAL_CARDS: EditorialCard[] = [
  {
    kind: "Annual Data Report · 2026",
    title: "The State of Memory Care in California",
    desc: "Year-over-year analysis of inspection reports across licensed facilities — deficiency rates by county, severity trends, and the operators with the cleanest and most concerning records.",
    meta: "Live · Dataset overview",
    href: "/data",
    live: true,
  },
  {
    kind: "Regional costs",
    title: "Memory care costs by California city & region",
    desc: "Benchmark monthly bands by metro — planning estimates families use before facility-specific quotes.",
    meta: "Live · Regional bands",
    href: "/california/cost-by-city",
    live: true,
  },
  {
    kind: "Comparison Hub",
    title: "Memory care vs. nursing home (SNF)",
    desc: "RCFE memory care vs skilled nursing — licensing, Medicare framing, Medi-Cal context, and what to verify on tours.",
    meta: "Live · Decision guide",
    href: "/library/memory-care-vs-nursing-home",
    live: true,
  },
  {
    kind: "California payer literacy",
    title: "Medi-Cal & memory care — what families need to know",
    desc: "Room & board vs services, Assisted Living Waiver context, and pairing payer questions with inspection history.",
    meta: "Live · PHN-reviewed",
    href: "/library/medi-cal-and-memory-care",
    live: true,
  },
  {
    kind: "Decision framework",
    title: "When is it time for memory care?",
    desc: "Safety signals, parallel clinical + regulatory tracks, and tour discipline before you sign.",
    meta: "Live · Family guide",
    href: "/library/when-is-it-time-for-memory-care",
    live: true,
  },
  {
    kind: "Editorial library",
    title: "All guides & explainers",
    desc: "Costs, citations, tours, glossary, dementia vocabulary — every StarlynnCare article in one index.",
    meta: "Live · Full library",
    href: "/library",
    live: true,
  },
];

/** Placeholder set for future Texas rich hub — distinct from CA cards. */
export const TEXAS_EDITORIAL_CARDS: EditorialCard[] = [
  {
    kind: "Texas licensing",
    title: "Type A, B, and C assisted living in Texas",
    desc: "HHSC license classes describe facility capability — not the same as California Type A / Type B deficiency severity. How to read both on a profile.",
    meta: "Guide · In progress",
    href: null,
    live: false,
  },
];

export const CALIFORNIA_METHODOLOGY_STEPS: ReadonlyArray<{ n: string; t: string; p: string }> = [
  {
    n: "Step 01",
    t: "Pull the public record",
    p: "Inspection reports, deficiency findings, and complaint outcomes pulled directly from CDSS Community Care Licensing — weekly, with archived snapshots.",
  },
  {
    n: "Step 02",
    t: "Compare to peers",
    p: "Each facility's citations are benchmarked against similar California facilities — same license type, comparable bed count, same 36-month window.",
  },
  {
    n: "Step 03",
    t: "Publish, with footnotes",
    p: "Each profile shows citation numbers, dates, and severity levels. No black box. Every data point links to its source record.",
  },
];

export function californiaStatItems(stats: CaliforniaStateHubData["stats"]): StatItem[] {
  return [
    {
      n: stats.facilities > 0 ? stats.facilities.toLocaleString() : "0",
      label: "Licensed memory care facilities indexed across California",
      src: "CDSS",
    },
    {
      n: stats.inspections > 0 ? stats.inspections.toLocaleString() : "0",
      label: "State inspection reports, parsed and dated",
      src: "CDSS / CMS",
      delta: "Updated weekly",
    },
    {
      n: stats.severeCitations > 0 ? stats.severeCitations.toLocaleString() : "0",
      label: "Severe (Type-A & Type-B) deficiencies on file in the last 24 months",
      src: "CDSS",
    },
    {
      n: "0",
      label: "Referral commissions, lead fees, or paid placements accepted from operators",
      src: "Policy",
      delta: "Since day one",
    },
  ];
}
