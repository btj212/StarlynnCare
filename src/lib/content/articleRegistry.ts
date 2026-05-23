/**
 * Central article registry — every editorial guide and explainer in one typed manifest.
 *
 * Each entry carries:
 *   - `states`     which state hub guides pages surface this article ("all" = every state)
 *   - `tags`       topic categories used to group articles within a guides page
 *   - `live`       false = placeholder card, no live link yet
 *   - `reviewNote` content-audit flag for the "all" articles that still have state-specific copy
 *
 * When adding a new state, add state-specific articles here with `states: ["XX"]`.
 * Universal articles (`states: ["all"]`) must not contain state-specific regulatory terms
 * (RCFE, CDSS, Medi-Cal, CCL, HHSC, etc.) — see docs/NEW_STATE_PLAYBOOK.md.
 */

export type ArticleState = "CA" | "TX" | "OR" | "WA" | "MN" | "all";

export type ArticleTag =
  | "licensing"
  | "costs"
  | "clinical"
  | "decision"
  | "inspection"
  | "legal";

export type RegistryArticle = {
  slug: string;         // full href, e.g. "/library/memory-care-vs-nursing-home"
  title: string;
  desc: string;
  states: ArticleState[];
  tags: ArticleTag[];
  live: boolean;
  /** Content-audit note — shown nowhere in UI; only used for internal tracking. */
  reviewNote?: string;
};

export const ARTICLE_REGISTRY: RegistryArticle[] = [
  // ── Universal (all states) ────────────────────────────────────────────────
  {
    slug: "/library/when-is-it-time-for-memory-care",
    title: "When is it time for memory care?",
    desc: "Safety signals, parallel clinical + regulatory tracks, and tour discipline before you sign.",
    states: ["all"],
    tags: ["decision", "clinical"],
    live: true,
    reviewNote:
      "footer links to CA city hubs — acceptable for now; update before OR/WA launch",
  },
  {
    slug: "/library/dementia-vs-alzheimers-vs-lewy-body",
    title: "Dementia vs. Alzheimer's vs. Lewy body",
    desc: "Non-diagnostic primer for caregivers — terminology, progression patterns, and why tours differ.",
    states: ["all"],
    tags: ["clinical"],
    live: true,
    reviewNote: "byline credits CA RN — content is universal enough; no rewrite needed",
  },
  {
    slug: "/memory-care-vs-assisted-living",
    title: "Memory care vs. assisted living",
    desc: "Regulation, staffing, environment of care, and cost — when dementia-specific programming matters.",
    states: ["all"],
    tags: ["decision"],
    live: true,
    reviewNote:
      "uses CA inspections as examples — acceptable framing for now; update before OR/WA launch",
  },
  {
    slug: "/library/37-questions-to-ask-on-a-memory-care-tour",
    title: "37 questions to ask on a memory care tour",
    desc: "Universal printable checklist — translates across CDSS, HHSC, OR DHS, WA DSHS, and MN MDH regulator frameworks.",
    states: ["all"],
    tags: ["decision"],
    live: true,
  },

  // ── California ────────────────────────────────────────────────────────────
  {
    slug: "/library/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home (SNF) in California",
    desc: "RCFE memory care vs skilled nursing — licensing (CDSS vs CMS), Medi-Cal ALW, and what to verify on tours.",
    states: ["CA"],
    tags: ["decision", "licensing"],
    live: true,
  },
  {
    slug: "/library/medi-cal-and-memory-care",
    title: "Medi-Cal & memory care — what families need to know",
    desc: "Room & board vs services, Assisted Living Waiver context, and pairing payer questions with inspection data.",
    states: ["CA"],
    tags: ["costs", "legal"],
    live: true,
  },
  {
    slug: "/library/type-a-vs-type-b-deficiencies-explained",
    title: "Type-A vs. Type-B deficiencies, explained",
    desc: "How California cites immediate-risk findings vs lesser violations — read the public record with confidence.",
    states: ["CA"],
    tags: ["inspection", "licensing"],
    live: true,
  },
  {
    slug: "/california/cost-guide",
    title: "What memory care costs in California",
    desc: "Regional medians, RCFE billing structure, Medicare/Medi-Cal limits, and hidden fees.",
    states: ["CA"],
    tags: ["costs"],
    live: true,
  },
  {
    slug: "/california/cost-by-city",
    title: "Memory care costs by California city & region",
    desc: "Benchmark monthly bands by metro — planning estimates families use before facility-specific quotes.",
    states: ["CA"],
    tags: ["costs"],
    live: true,
  },
  {
    slug: "/california/glossary",
    title: "California memory care glossary",
    desc: "RCFE, ALW, and licensing terms you will see on profiles and CDSS exports.",
    states: ["CA"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/california/37-questions-to-ask-on-a-tour",
    title: "37 questions to ask on a memory care tour",
    desc: "Structured checklist for executives, night staff, and families in the hallway.",
    states: ["CA"],
    tags: ["decision"],
    live: true,
  },

  // ── Texas ─────────────────────────────────────────────────────────────────
  {
    slug: "/texas/type-a-b-c-licensing",
    title: "Type A, B, and C assisted living in Texas",
    desc: "HHSC license classes describe facility capability — not deficiency severity. How to read both on a StarlynnCare profile.",
    states: ["TX"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/texas/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home (SNF) in Texas",
    desc: "ALF memory care vs skilled nursing — HHSC licensing, Medicare framing, STAR+PLUS waiver context, and what to verify on tours.",
    states: ["TX"],
    tags: ["decision", "licensing"],
    live: true,
  },

  // ── Oregon ────────────────────────────────────────────────────────────────
  {
    slug: "/oregon/memory-care-licensing",
    title: "Oregon memory care licensing — ALFs, RCFs & the Memory Care Endorsement",
    desc: "Oregon licenses memory care as ALFs and RCFs under ORS ch. 443. A separate DHS Memory Care Endorsement governs dementia-specific programming.",
    states: ["OR"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/oregon/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home in Oregon",
    desc: "Oregon DHS regulates ALF/RCF memory care; CMS and OHA regulate nursing homes (SNFs). Different records, different Medicaid funding.",
    states: ["OR"],
    tags: ["decision", "licensing"],
    live: true,
  },

  // ── Washington ────────────────────────────────────────────────────────────
  {
    slug: "/washington/memory-care-licensing",
    title: "Washington memory care licensing — ALFs & Specialized Dementia Care",
    desc: "Washington licenses memory care in ALFs under RCW 18.20. A DSHS Specialized Dementia Care contract is required for dementia-focused facilities.",
    states: ["WA"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/washington/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home in Washington",
    desc: "DSHS regulates Washington ALF memory care; CMS and WA DOH regulate nursing homes (SNFs). Different records, different Medicaid funding.",
    states: ["WA"],
    tags: ["decision", "licensing"],
    live: true,
  },

  {
    slug: "/washington/why-dshs-contract-isnt-a-quality-badge",
    title: "Why a DSHS Dementia Care contract isn't a quality badge",
    desc: "What the contract is, what the WA inspection record shows, and why we don't elevate it to badge status on facility profiles.",
    states: ["WA"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/washington/how-to-read-our-inspection-data",
    title: "How to read our Washington inspection data",
    desc: "Complaint concentration, severity definitions, and what we deliberately don't show on WA facility profiles.",
    states: ["WA"],
    tags: ["inspection"],
    live: true,
  },

  // ── Minnesota ─────────────────────────────────────────────────────────────
  {
    slug: "/minnesota/memory-care-licensing",
    title: "Minnesota memory care licensing — ALF with Dementia Care (Chapter 144G)",
    desc: "Minnesota licenses memory care as Assisted Living Facility with Dementia Care under Chapter 144G, regulated by MDH. Effective August 2021.",
    states: ["MN"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/minnesota/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home in Minnesota",
    desc: "MDH regulates Minnesota ALF-DC memory care; CMS and MDH (Ch. 144A) regulate nursing homes (SNFs). Different records, different Medicaid funding.",
    states: ["MN"],
    tags: ["decision", "licensing"],
    live: true,
  },
];

/**
 * Returns all live articles tagged for a given state code OR tagged "all".
 * Pass the two-letter state code (e.g. "TX", "CA").
 */
export function getArticlesForState(stateCode: string): RegistryArticle[] {
  const code = stateCode.toUpperCase() as ArticleState;
  return ARTICLE_REGISTRY.filter(
    (a) => a.live && (a.states.includes("all") || a.states.includes(code)),
  );
}

/**
 * Returns articles grouped by their primary tag (first tag wins).
 * Useful for rendering a guides page with editorial sections.
 */
export function groupArticlesByTag(
  articles: RegistryArticle[],
): Map<ArticleTag, RegistryArticle[]> {
  const map = new Map<ArticleTag, RegistryArticle[]>();
  for (const article of articles) {
    const primary = article.tags[0];
    if (!primary) continue;
    const group = map.get(primary) ?? [];
    group.push(article);
    map.set(primary, group);
  }
  return map;
}
