/**
 * Short editorial intros for high-traffic city hubs — plain language, no fabricated stats.
 *
 * Keys are namespaced as `${STATE_CODE}:${slug}` to prevent cross-state slug collisions
 * (e.g. Albany exists in CA and OR; Salem in OR and MA; Bend in OR and TX). Always look
 * up via `cityIntroForRegion(stateCode, slug)`.
 */
const INTROS: Record<string, string> = {
  // ── California ──────────────────────────────────────────────────────────────
  "CA:oakland":
    "Oakland sits between Berkeley and the East Bay hills — a dense market where families balance commute times, pricing, and how far they are willing to travel for visits. Use profiles below to compare inspection history side-by-side before you tour.",
  "CA:berkeley":
    "Berkeley\u2019s memory care options range from smaller RCFE footprints to larger licensed communities. Inspection narratives here are pulled straight from CDSS — compare repeat citations and complaint-driven visits before shortlisting.",
  "CA:fremont":
    "Fremont families often weigh Tri-City access and South Bay commute corridors when choosing care. Filter by citations and bed count to narrow operators with a documented regulatory track record.",
  "CA:hayward":
    "Hayward anchors the central East Bay for many families priced out of coastal cities. Focus on deficiency trends over multiple years — not a single snapshot — when judging operator consistency.",
  "CA:pleasanton":
    "Pleasanton skews toward suburban campuses and medium-sized RCFE footprints. Pair inspection data with tours that ask night-shift and weekend coverage questions — staffing volatility shows up in citations when it exists.",
  "CA:livermore":
    "Livermore combines valley commuting patterns with a growing older-adult population. Use peer benchmarks on each profile to see whether citations are typical for similar-sized homes.",
  "CA:alameda":
    "Island geography means families often compare Alameda homes against Oakland and San Leandro options simultaneously. Cross-check inspection dates with move-in timing — serious citations deserve context from the full narrative.",
  "CA:albany":
    "Albany is a tight geography with fewer licensed footprints than neighboring cities — each inspection record matters. Read deficiency codes on the profile before assuming marketing claims match regulatory history.",
  "CA:castro-valley":
    "Castro Valley sits between hills communities and Hayward — useful for families bridging East Bay visits. Compare sibling cities in Alameda County using county-level hubs for breadth.",
  "CA:san-francisco":
    "San Francisco\u2019s density means families weigh square footage, staffing ratios, and elevator evacuation plans differently than in suburban RCFEs. Inspection reports highlight environmental-of-care issues when surveyors document them.",
  "CA:los-angeles":
    "Los Angeles spans an enormous geography — anchor your search with ZIP-level commute realities, then compare operators with documented inspection histories across similar license classes.",
  "CA:san-diego":
    "San Diego families often sequence coastal communities against inland pricing. Use citation filters to identify operators whose regulatory records diverge from peers at comparable scale.",
  "CA:sacramento":
    "Sacramento offers a mix of capital-region operators and migrating Bay Area families seeking relative value. Benchmark severity and repeat citations against peer cohorts on each profile.",
  "CA:fresno":
    "The Central Valley market differs sharply from coastal metros on staffing recruitment and climate-driven building issues. Longitudinal inspection data matters more than any single annual survey.",
  "CA:modesto":
    "Modesto families frequently compare Stockton and Stanislaus county peers in parallel. County hubs aggregate breadth — city pages focus your comparison set.",
  "CA:stockton":
    "Stockton\u2019s RCFE market rewards disciplined comparison across complaint-driven inspections versus routine surveys. Read whether citations clustered around staffing, infection control, or resident assessment.",
  "CA:san-bernardino":
    "The Inland Empire market varies block-by-block — use peer percentiles on each profile rather than reputation alone when prioritizing tours.",
  "CA:santa-rosa":
    "Santa Rosa families rebuilding after disasters often weigh newer builds against operators with long inspection histories. Cross-reference citations with structural/environment narratives in CDSS reports.",
  "CA:riverside":
    "Riverside County stretches from Corona commute sheds to desert cities — climate and staffing markets differ sharply by sub-region. Start with citation trends, then narrow geographically.",
  "CA:visalia":
    "Visalia anchors Tulare County medical referrals for many surrounding towns. Compare operators serving similar bed counts — peer analytics on profiles highlight outliers.",

  // ── Oregon ───────────────────────────────────────────────────────────────────
  "OR:portland":
    "Portland's memory care market spans a wide geography — from inner SE neighborhoods to Beaverton and Lake Oswego suburbs. Facilities here hold Oregon DHS Memory Care Endorsements; inspection records on each profile reflect DHS licensing violations and complaint outcomes, not California CDSS criteria.",
  "OR:lake-oswego":
    "Lake Oswego draws families seeking proximity to Portland with a quieter suburban setting. Compare DHS inspection histories and endorsement status before scheduling tours — the endorsement is required, but the depth of programming varies significantly by operator.",
  "OR:beaverton":
    "Beaverton's tech-corridor demographics mean higher family expectations and a range of pricing tiers. Oregon DHS violation history on each profile is the most reliable public signal for operator consistency — read complaint-driven investigation outcomes alongside routine inspection results.",
  "OR:gresham":
    "Gresham sits at the eastern edge of the Portland metro, with generally lower price points than western suburbs. Use the DHS enforcement record to identify operators with repeated licensing violations before narrowing your tour list.",
  "OR:eugene":
    "Eugene anchors the Willamette Valley south of Portland with a distinct care market. DHS Memory Care Endorsement status is required for any facility indexed here — read violation history with attention to complaint investigations, which reflect resident and family-triggered findings.",
  "OR:salem":
    "Salem is the capital-region hub for mid-Willamette Valley families. Compare ALF and RCF endorsement holders using DHS inspection dates — older inspection records deserve closer scrutiny about whether staffing or programming has changed.",
  "OR:bend":
    "Bend's rapid growth has brought new ALF construction alongside established operators. For newer facilities, pay attention to opening inspection dates and whether routine surveys have caught up to marketing claims.",
  "OR:medford":
    "Medford serves southern Oregon families who often face longer drives to urban alternatives. DHS inspection outcomes are the clearest independent signal for operators in this market — read complaint findings alongside routine visit results.",

  // ── Washington ───────────────────────────────────────────────────────────────
  "WA:seattle":
    "Seattle's memory care market is dense and expensive — ALFs here hold DSHS Specialized Dementia Care contracts as the minimum bar for appearing on StarlynnCare. Inspection and investigation report links on each profile go directly to the DSHS ALF Reports portal.",
  "WA:bellevue":
    "Bellevue families often compare Eastside operators against Seattle and south King County options simultaneously. DSHS investigation findings from complaint-driven visits are the most revealing part of the record — look for clusters of incident reports over time.",
  "WA:tacoma":
    "Tacoma anchors Pierce County with a broader price range than Seattle. Focus on DSHS inspection frequency and investigation outcomes — facilities with more reports aren't automatically worse, but the content of findings matters.",
  "WA:spokane":
    "Spokane is the eastern Washington hub, with a distinct care market from Puget Sound. DSHS investigation records on each profile reflect complaint-driven reviews — compare these across similarly sized operators before touring.",
  "WA:kirkland":
    "Kirkland sits between Bellevue and north Seattle — families often cross-compare Eastside corridors. DSHS reports for each facility link directly to publicly posted inspection and investigation PDFs, which contain narrative detail not captured in summary form.",
  "WA:redmond":
    "Redmond's tech-adjacent demographics mean well-resourced families with high expectations and operators who price accordingly. DSHS enforcement letters — visible in each profile's report list — signal regulatory escalation beyond standard inspections.",
  "WA:federal-way":
    "Federal Way bridges South King and North Pierce counties, useful for families splitting commutes. Compare DSHS Specialized Dementia Care contract holders using the investigation record — complaint-driven findings predict staffing and programming quality better than marketing materials.",
  "WA:olympia":
    "Olympia families often weigh proximity to Tacoma alternatives. DSHS regulatory records here are the same statewide public database — read investigation outcomes alongside routine inspection results before shortlisting.",
  "WA:kent":
    "Kent is a mid-corridor market between Seattle and Tacoma. Compare operators using DSHS report frequency and content — enforcement letters are the strongest signal of regulatory concern beyond routine inspections.",
  "WA:renton":
    "Renton families frequently consider Bellevue and south Seattle options in parallel. DSHS investigation records often capture complaint-originated reviews that don't appear in routine survey summaries — read both categories.",
};

/**
 * Look up a city intro by state + slug. Always pass the two-letter state code so
 * cross-state slug collisions (e.g. Albany CA vs Albany OR) resolve correctly.
 */
export function cityIntroForRegion(
  stateCode: string,
  regionSlug: string,
): string | null {
  const key = `${stateCode.toUpperCase()}:${regionSlug.toLowerCase()}`;
  return INTROS[key] ?? null;
}

/**
 * @deprecated Use `cityIntroForRegion(stateCode, slug)` to avoid cross-state slug collisions.
 * Retained as a no-op shim to flag any remaining call sites — always returns null.
 */
export function cityIntroForSlug(_regionSlug: string): string | null {
  return null;
}
