/**
 * Single source of truth for the /research hub. Each entry corresponds to one
 * standalone analysis page or one flagship report.
 *
 * Adding a new analysis: create the page file under `src/app/research/<slug>/`
 * and append the entry here. The hub, llms.txt, and sitemap all read from this
 * registry so URLs stay in sync.
 */

export type ResearchKind = "analysis" | "flagship-report";

export type ResearchEntry = {
  href: string;
  kind: ResearchKind;
  title: string;
  dek: string;
  scope: string;
  bylineDate: string;
  /** One-line numerical headline shown on the hub card. */
  headlineFinding: string;
};

export const RESEARCH_INDEX: ResearchEntry[] = [
  {
    href: "/reports/california-rcfe-repeat-citations-2026",
    kind: "flagship-report",
    title:
      "1 in 8 California senior care facilities has repeat regulatory citations",
    dek: "Long-form report on 484 California RCFEs, including the chain operator scorecard, repeat-citation patterns, and the post-COVID severity trend.",
    scope: "California",
    bylineDate: "May 2026",
    headlineFinding: "63 facilities cited for the same rule 3+ times",
  },
  {
    href: "/research/california-cost-vs-quality",
    kind: "analysis",
    title: "In California memory care, price is no guarantee of quality",
    dek: "Pearson r = 0.27 between county-median monthly cost and citation severity across 484 California memory care facilities — essentially flat. The most expensive county is not the worst-cited county.",
    scope: "California",
    bylineDate: "May 2026",
    headlineFinding: "r = 0.27 price–severity correlation",
  },
  {
    href: "/research/california-memory-care-violations",
    kind: "analysis",
    title:
      "What inspectors actually cite at California memory care facilities",
    dek: "Of 7,748 California memory care deficiencies on record, only 6% fall under the dementia-specific statutes. The dominant harm category in inspector narratives is staffing inadequacy.",
    scope: "California",
    bylineDate: "May 2026",
    headlineFinding: "1,069 staffing-inadequacy mentions",
  },
  {
    href: "/research/california-geographic-equity",
    kind: "analysis",
    title:
      "High-income California ZIPs do not have better memory care records",
    dek: "ZIP-level household income explains almost none of the variation in CA memory care deficiency rates (r = 0.23). Several of the highest-income ZIPs rank among the worst-cited.",
    scope: "California",
    bylineDate: "May 2026",
    headlineFinding: "r = 0.23 income–deficiency correlation",
  },
  {
    href: "/research/california-inspection-seasonality",
    kind: "analysis",
    title:
      "California memory care citations cluster in fall — and almost never on weekends",
    dek: "August carries the highest single-month citation count, fall is the highest-citation season, and weekends see almost no inspections — meaning many facilities go unobserved Saturday through Sunday.",
    scope: "California",
    bylineDate: "May 2026",
    headlineFinding: "692 citations in August alone",
  },
];
