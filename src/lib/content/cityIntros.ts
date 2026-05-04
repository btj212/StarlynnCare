/**
 * Short editorial intros for high-traffic city hubs — plain language, no fabricated stats.
 * Keys match `city_slug` / region slug for `kind: "city"` hubs.
 */
const INTROS: Record<string, string> = {
  oakland:
    "Oakland sits between Berkeley and the East Bay hills — a dense market where families balance commute times, pricing, and how far they are willing to travel for visits. Use profiles below to compare inspection history side-by-side before you tour.",
  berkeley:
    "Berkeley’s memory care options range from smaller RCFE footprints to larger licensed communities. Inspection narratives here are pulled straight from CDSS — compare repeat citations and complaint-driven visits before shortlisting.",
  fremont:
    "Fremont families often weigh Tri-City access and South Bay commute corridors when choosing care. Filter by citations and bed count to narrow operators with a documented regulatory track record.",
  hayward:
    "Hayward anchors the central East Bay for many families priced out of coastal cities. Focus on deficiency trends over multiple years — not a single snapshot — when judging operator consistency.",
  "pleasanton":
    "Pleasanton skews toward suburban campuses and medium-sized RCFE footprints. Pair inspection data with tours that ask night-shift and weekend coverage questions — staffing volatility shows up in citations when it exists.",
  livermore:
    "Livermore combines valley commuting patterns with a growing older-adult population. Use peer benchmarks on each profile to see whether citations are typical for similar-sized homes.",
  alameda:
    "Island geography means families often compare Alameda homes against Oakland and San Leandro options simultaneously. Cross-check inspection dates with move-in timing — serious citations deserve context from the full narrative.",
  albany:
    "Albany is a tight geography with fewer licensed footprints than neighboring cities — each inspection record matters. Read deficiency codes on the profile before assuming marketing claims match regulatory history.",
  "castro-valley":
    "Castro Valley sits between hills communities and Hayward — useful for families bridging East Bay visits. Compare sibling cities in Alameda County using county-level hubs for breadth.",
  "san-francisco":
    "San Francisco’s density means families weigh square footage, staffing ratios, and elevator evacuation plans differently than in suburban RCFEs. Inspection reports highlight environmental-of-care issues when surveyors document them.",
  "los-angeles":
    "Los Angeles spans an enormous geography — anchor your search with ZIP-level commute realities, then compare operators with documented inspection histories across similar license classes.",
  "san-diego":
    "San Diego families often sequence coastal communities against inland pricing. Use citation filters to identify operators whose regulatory records diverge from peers at comparable scale.",
  sacramento:
    "Sacramento offers a mix of capital-region operators and migrating Bay Area families seeking relative value. Benchmark severity and repeat citations against peer cohorts on each profile.",
  fresno:
    "The Central Valley market differs sharply from coastal metros on staffing recruitment and climate-driven building issues. Longitudinal inspection data matters more than any single annual survey.",
  modesto:
    "Modesto families frequently compare Stockton and Stanislaus county peers in parallel. County hubs aggregate breadth — city pages focus your comparison set.",
  stockton:
    "Stockton’s RCFE market rewards disciplined comparison across complaint-driven inspections versus routine surveys. Read whether citations clustered around staffing, infection control, or resident assessment.",
  "san-bernardino":
    "The Inland Empire market varies block-by-block — use peer percentiles on each profile rather than reputation alone when prioritizing tours.",
  "santa-rosa":
    "Santa Rosa families rebuilding after disasters often weigh newer builds against operators with long inspection histories. Cross-reference citations with structural/environment narratives in CDSS reports.",
  riverside:
    "Riverside County stretches from Corona commute sheds to desert cities — climate and staffing markets differ sharply by sub-region. Start with citation trends, then narrow geographically.",
  visalia:
    "Visalia anchors Tulare County medical referrals for many surrounding towns. Compare operators serving similar bed counts — peer analytics on profiles highlight outliers.",
};

export function cityIntroForSlug(regionSlug: string): string | null {
  return INTROS[regionSlug.toLowerCase()] ?? null;
}
