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

export type ArticleState = "CA" | "TX" | "OR" | "WA" | "MN" | "IL" | "UT" | "PA" | "AZ" | "MO" | "CO" | "all";

export type ArticleTag =
  | "licensing"
  | "costs"
  | "clinical"
  | "decision"
  | "inspection"
  | "legal"
  | "data";

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
    slug: "/library/choosing-memory-care",
    title: "Choosing memory care, one decision at a time",
    desc: "Five steps that point at the guides already on the site. No new statistics.",
    states: ["all"],
    tags: ["decision"],
    live: true,
  },
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
    desc: "Where California care facility inspection reports are kept on the CDSS search, plus a search of the memory care homes we publish by name or license number.",
    states: ["CA"],
    tags: ["decision", "licensing"],
    live: true,
  },
  {
    slug: "/library/medi-cal-and-memory-care",
    title: "Does Medi-Cal pay for memory care in California?",
    desc: "Medi-Cal does not pay RCFE room and board. The Assisted Living Waiver can pay services in participating counties.",
    states: ["CA"],
    tags: ["costs", "legal"],
    live: true,
  },
  {
    slug: "/library/type-a-vs-type-b-deficiencies-explained",
    title: "Type A vs Type B citations: which is worse?",
    desc: "Type A is an immediate risk (48-hour plan). Type B is every other CDSS RCFE violation.",
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
    desc: "How to look up an Oregon assisted living license and its inspections on the state site, plus a search of the memory care homes we publish by name or license number.",
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
    desc: "Where Washington assisted living inspection reports are kept on the DSHS lookup, plus a search of the memory care homes we publish by name or license number.",
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
    desc: "How to look up a Minnesota assisted living license on the MDH provider directory, plus a search of the memory care homes we publish by name or license number.",
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

  // ── Pennsylvania ──────────────────────────────────────────────────────────
  {
    slug: "/pennsylvania/memory-care-licensing",
    title: "Pennsylvania memory care licensing — PCH vs. ALR and the Special Care designation",
    desc: "Where Pennsylvania personal care home inspection reports are kept in the DHS directory, plus a search of the memory care homes we publish by name or license number.",
    states: ["PA"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/pennsylvania/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home in Pennsylvania",
    desc: "DHS OLTL regulates PA PCH/ALR memory care; PA DOH and CMS regulate nursing homes (SNFs). Different regulators, different inspection records, different Medicaid funding.",
    states: ["PA"],
    tags: ["decision", "licensing"],
    live: true,
  },

  // Pennsylvania — PCH explainer cluster
  {
    slug: "/pennsylvania/what-is-a-personal-care-home",
    title: "What is a Personal Care Home in Pennsylvania?",
    desc: "PCH definition, licensing (55 Pa Code Ch 2600), Special Care designation, and how DHS OLTL inspections work.",
    states: ["PA"],
    tags: ["licensing"],
    live: true,
  },
  {
    slug: "/pennsylvania/personal-care-home-vs-assisted-living",
    title: "Personal care home vs. assisted living in Pennsylvania",
    desc: "PCH (Ch 2600) vs. ALR (Ch 2800) — care level, staffing, Medicaid, and what each means for memory care in PA.",
    states: ["PA"],
    tags: ["decision", "licensing"],
    live: true,
  },
  {
    slug: "/pennsylvania/personal-care-home-cost",
    title: "How much does a personal care home cost in Pennsylvania?",
    desc: "PA PCH and ALR homes typically cost $4,000–$8,500 a month. Medicaid does not pay room and board.",
    states: ["PA"],
    tags: ["costs"],
    live: true,
  },

  // Pennsylvania insights — data analysis stories
  {
    slug: "/pennsylvania/insights/pa-rural-home-highest-immediate-jeopardy",
    title: "A 48-bed rural PA home holds the state's highest immediate-jeopardy count",
    desc: "Penn Highlands Jefferson Manor in rural Brookville recorded 21 immediate-jeopardy findings — more than any other licensed memory care facility in Pennsylvania.",
    states: ["PA"],
    tags: ["data", "inspection"],
    live: true,
  },
  {
    slug: "/pennsylvania/insights/philadelphia-suburbs-worst-records",
    title: "Philadelphia's affluent suburbs have some of PA's worst memory care records",
    desc: "Chester and Montgomery counties are among the Pennsylvania counties with the highest deficiencies per facility. Chester County's 26 facilities average 80 deficiencies each.",
    states: ["PA"],
    tags: ["data", "inspection"],
    live: true,
  },
  {
    slug: "/pennsylvania/insights/bigger-not-safer",
    title: "Bigger isn't safer: PA's largest facilities average nearly 4× more severe citations",
    desc: "PA facilities with 100+ beds average 5.1 severe findings per facility — nearly four times the rate of homes with fewer than 20 beds.",
    states: ["PA"],
    tags: ["data", "inspection"],
    live: true,
  },

  // ── Arizona ───────────────────────────────────────────────────────────────
  {
    slug: "/arizona/memory-care-licensing",
    title: "Arizona memory care licensing — ALH, ALC & the ADHS Directed Care license level",
    desc: "Where Arizona assisted living inspection reports are kept on AZ Care Check, plus a search of the memory care homes we publish by name or license number.",
    states: ["AZ"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/arizona/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home in Arizona",
    desc: "ADHS regulates ALH/ALC memory care; CMS and CMS-certified SNFs handle nursing home level care. Different records, different ALTCS Medicaid funding streams.",
    states: ["AZ"],
    tags: ["decision", "licensing"],
    live: true,
  },

  // ── Missouri ──────────────────────────────────────────────────────────────
  {
    slug: "/missouri/memory-care-licensing",
    title: "Missouri memory care licensing — ALF**, Alzheimer's SCU Disclosure & 19 CSR 30",
    desc: "Missouri has no standalone memory care license. The Alzheimer's Special Care Services Disclosure (§198.510 RSMo) and ALF** license (§198.073.6) are the authoritative signals. How to read a Missouri profile on StarlynnCare.",
    states: ["MO"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/missouri/memory-care-vs-nursing-home",
    title: "Memory care vs. nursing home in Missouri",
    desc: "DHSS regulates ALF/RCF memory care; CMS + DHSS regulate SNF/ICF nursing homes. Different inspection records, different MO HealthNet Medicaid coverage.",
    states: ["MO"],
    tags: ["decision", "licensing"],
    live: true,
  },

  {
    slug: "/colorado/memory-care-licensing",
    title: "How Colorado licenses assisted living",
    desc: "CDPHE licenses assisted living under Chapter 7. There is no separate memory-care license and no public secure-environment roster.",
    states: ["CO"],
    tags: ["licensing", "inspection"],
    live: true,
  },
  {
    slug: "/colorado/memory-care-vs-nursing-home",
    title: "Assisted living and nursing homes in Colorado",
    desc: "CDPHE Level A–E citations and CMS F-tags are different records. StarlynnCare does not score them on one scale.",
    states: ["CO"],
    tags: ["decision", "licensing"],
    live: true,
  },
  {
    slug: "/oregon/is-it-licensed-for-memory-care",
    title: "Is this Oregon home endorsed for memory care?",
    desc: "Oregon bars advertising memory care until DHS grants the endorsement. How to check the license, and how many published homes the state file lists as endorsed.",
    states: ["OR"],
    tags: ["licensing"],
    live: true,
  },
  {
    slug: "/pennsylvania/is-it-licensed-for-memory-care",
    title: "Is this Pennsylvania home licensed for memory care?",
    desc: "A secured dementia care unit on a personal care home, and special care on an assisted living residence. What each rule says, and how many homes the state file lists.",
    states: ["PA"],
    tags: ["licensing"],
    live: true,
  },
  {
    slug: "/missouri/is-it-licensed-for-memory-care",
    title: "Is this Missouri home licensed for memory care?",
    desc: "Missouri has no standalone memory care license. The Alzheimer's special care unit disclosure and the ALF** license are different filings.",
    states: ["MO"],
    tags: ["licensing"],
    live: true,
  },
  {
    slug: "/arizona/how-to-check-a-memory-care-record",
    title: "Arizona assisted living inspection lookup",
    desc: "Search an Arizona assisted living home by name or license number, see its inspections, and find the full report on AZ Care Check.",
    states: ["AZ"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/california/how-to-check-a-memory-care-record",
    title: "California care facility inspection lookup",
    desc: "Search a California memory care or assisted living home by name or license number, see its citations, and find the report on the CDSS search.",
    states: ["CA"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/pennsylvania/how-to-check-a-memory-care-record",
    title: "Pennsylvania personal care home inspection reports",
    desc: "Search a Pennsylvania personal care home by name or license number and read its inspection reports. Where the DHS directory keeps the originals.",
    states: ["PA"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/washington/how-to-check-a-memory-care-record",
    title: "How to check a Washington memory care inspection record",
    desc: "Look up a Washington home on the DSHS locator, open its ALF Reports page, and read the newest inspection.",
    states: ["WA"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/oregon/how-to-check-a-memory-care-record",
    title: "Oregon assisted living license lookup",
    desc: "Look up an Oregon assisted living or memory care license by home name or license number, see its inspections, and find the state record.",
    states: ["OR"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/illinois/how-to-check-a-memory-care-record",
    title: "IDPH assisted living lookup for Illinois",
    desc: "How to find an Illinois assisted living home on the IDPH facility lookup, plus a search of the memory care homes we publish. We hold no Illinois nursing homes, only assisted living establishments.",
    states: ["IL"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/minnesota/how-to-check-a-memory-care-record",
    title: "Minnesota assisted living license lookup",
    desc: "Look up a Minnesota assisted living license by home name or license number, see its inspections, and find the MDH provider directory record.",
    states: ["MN"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/texas/is-it-licensed-for-memory-care",
    title: "Is this Texas home certified for Alzheimer's care?",
    desc: "A home that advertises specialized Alzheimer's care needs an HHSC certification. What the rule requires, and how many published homes the state file lists.",
    states: ["TX"],
    tags: ["licensing"],
    live: true,
  },
  {
    slug: "/library/what-a-serious-citation-means",
    title: "What a serious citation means in each state",
    desc: "Serious is not one legal term. What each state's profile calls its red tag, and how the count on /data is wider than some of those tags.",
    states: ["CA", "TX", "OR", "WA", "MN", "IL", "UT", "PA", "AZ", "MO", "CO"],
    tags: ["inspection"],
    live: true,
  },
  {
    slug: "/library/the-first-72-hours",
    title: "The first 72 hours: a family crisis playbook",
    desc: "Discharge rights, the five questions before signing anything, ombudsman contacts, and a conflict-free shortlist.",
    states: ["all"],
    tags: ["decision"],
    live: true,
  },
  {
    slug: "/california/memory-care-licensing",
    title: "California memory care licensing: RCFEs, CDSS, and Type A/B deficiencies",
    desc: "California licenses memory care homes as RCFEs under CDSS. What the Alzheimer's special care disclosure means, and how to read a profile.",
    states: ["CA"],
    tags: ["licensing"],
    live: true,
  },
  {
    slug: "/illinois/memory-care-licensing",
    title: "Illinois memory care licensing: ALEs, SHEs, and IDPH",
    desc: "Illinois licenses residential memory care as Assisted Living Establishments or Shared Housing Establishments under IDPH and 77 Ill. Adm. Code Part 295.",
    states: ["IL"],
    tags: ["licensing"],
    live: true,
  },
  {
    slug: "/illinois/memory-care-vs-nursing-home",
    title: "Assisted living and nursing homes in Illinois are not the same record",
    desc: "IDPH licenses assisted living and shared housing under 210 ILCS 9. CMS surveys nursing homes. A memory-care name is not an Alzheimer's designation.",
    states: ["IL"],
    tags: ["decision", "licensing"],
    live: true,
  },
  {
    slug: "/utah/memory-care-licensing",
    title: "Utah memory care licensing: assisted living and DLBC",
    desc: "Utah licenses assisted living through the Division of Licensing and Background Checks. How inspections are labeled on a profile.",
    states: ["UT"],
    tags: ["licensing"],
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
