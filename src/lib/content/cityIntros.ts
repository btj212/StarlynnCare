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

  // ── Washington (expanded) ────────────────────────────────────────────────
  "WA:spokane-valley":
    "Spokane Valley's suburban setting offers more facilities than downtown Spokane for families seeking space. DSHS Specialized Dementia Care contract holders are the only operators indexed here — compare investigation records before touring.",
  "WA:kennewick":
    "Kennewick anchors the Tri-Cities market alongside Richland and Pasco. DSHS inspection and complaint investigation history for each facility links directly to the state portal — read these as a set across the Tri-Cities before choosing.",
  "WA:bremerton":
    "Bremerton families often face ferry and bridge logistics when comparing options across Kitsap Peninsula. DSHS reports for each facility reflect both routine surveys and complaint-driven investigations.",
  "WA:puyallup":
    "Puyallup serves Pierce County families east of Tacoma. DSHS Specialized Dementia Care contract status is the minimum bar for facilities indexed here — enforcement letters are the strongest signal of regulatory concern beyond routine surveys.",
  "WA:lacey":
    "Lacey sits in greater Olympia and offers options for south Sound families. DSHS investigation records and inspection history are publicly posted for each facility on the state ALF reports portal.",
  "WA:vancouver":
    "Vancouver, WA sits across the Columbia River from Portland — families frequently compare options in both states. Washington DSHS inspection records (indexed here) and Oregon DHS records (for Portland-area facilities) use different regulatory frameworks.",
  "WA:yakima":
    "Yakima is the central Washington agricultural hub with a distinct care market from Puget Sound. DSHS enforcement records are the same public database — read complaint investigations alongside routine surveys.",
  "WA:pasco":
    "Pasco is part of the Tri-Cities corridor with Kennewick and Richland. DSHS reports for all three cities can be reviewed in parallel — aggregate the investigation record before committing to a tour schedule.",
  "WA:centralia":
    "Centralia is midway between Olympia and Portland — useful for families splitting distance between two metros. DSHS inspection records are the clearest independent signal for operators in this corridor.",
  "WA:chehalis":
    "Chehalis sits in the Lewis County corridor between Olympia and Portland. Compare investigation findings with Centralia alternatives using DSHS records — the complaint-driven reports capture issues routine surveys sometimes miss.",

  // ── Oregon (expanded) ────────────────────────────────────────────────────
  "OR:grants-pass":
    "Grants Pass serves the Rogue Valley with options for families between Medford and the coast. Oregon DHS Memory Care Endorsement status is required for all facilities indexed here — DHS inspection and complaint records are publicly available.",
  "OR:mcminnville":
    "McMinnville anchors Yamhill County wine country south of Portland. DHS licensing violation history is the best independent quality signal — read complaint-driven investigation outcomes alongside routine surveys.",
  "OR:hillsboro":
    "Hillsboro's tech-corridor demographics mirror Beaverton's pricing dynamics on the west side. DHS inspection records for endorsed facilities reflect both routine and complaint-driven reviews — read both categories before shortlisting.",
  "OR:springfield":
    "Springfield families often compare Lane County options with Eugene simultaneously. DHS violation history and Memory Care Endorsement renewal dates help distinguish operators with consistent regulatory track records.",
  "OR:milwaukie":
    "Milwaukie sits between Portland and Lake Oswego — useful for families bridging inner metro access. DHS Memory Care Endorsement holders are indexed here; violation counts and investigation outcomes vary more than endorsement status alone suggests.",
  "OR:albany":
    "Albany anchors mid-valley families between Salem and Corvallis. For each Oregon facility, the DHS endorsement is necessary but not sufficient — compare complaint investigation outcomes to assess operator responsiveness.",
  "OR:roseburg":
    "Roseburg serves Douglas County families in southern Oregon. DHS inspection and complaint records are the primary public quality signal in this market — read the full investigation narrative, not just the outcome code.",
  "OR:woodburn":
    "Woodburn sits between Salem and Portland on I-5 — practical for families commuting between metro areas. DHS endorsement holders in this corridor have inspectable records on the state portal.",
  "OR:redmond":
    "Redmond serves Central Oregon families alongside Bend. For newer facilities built with Bend-area growth, compare opening inspection dates against recent surveys — the regulatory record builds over time.",

  // ── Texas ────────────────────────────────────────────────────────────────
  "TX:houston":
    "Houston is one of the largest memory care markets in Texas — a sprawling metro where family commute time and proximity to medical centers drive geography as much as quality scores. All facilities indexed here hold an active HHSC Alzheimer Certification; compare HHSC LTCR inspection findings before touring.",
  "TX:san-antonio":
    "San Antonio blends major medical infrastructure with a large military-adjacent family population. HHSC LTCR inspection records for each facility are the primary public quality signal — read scope and severity of cited deficiencies alongside certification status.",
  "TX:dallas":
    "Dallas families typically anchor searches in specific corridors — Uptown, North Dallas, or the Plano-Frisco axis. HHSC license type (A, B, or C) and Alzheimer Certification status are listed on each profile; deficiency records reflect the full LTCR inspection history.",
  "TX:austin":
    "Austin's growth has brought a wide range of ALF memory care options at varying price points. HHSC inspection frequency and deficiency scope are the most reliable public signals for distinguishing operators in this competitive market.",
  "TX:fort-worth":
    "Fort Worth families often compare Tarrant County options against North Dallas and Denton alternatives. HHSC LTCR records here use the same scope-and-severity framework as the rest of Texas — read both routine survey and complaint investigation outcomes.",
  "TX:plano":
    "Plano anchors the North Dallas Collin County corridor with a concentration of mid-to-upper market memory care operators. HHSC Alzheimer Certification is required for all indexed facilities; deficiency history is the key differentiator.",
  "TX:spring":
    "Spring is a north Houston suburb with a growing senior housing market. HHSC inspection and complaint records for each facility reflect the same public LTCR dataset — compare operators by deficiency frequency and scope before touring.",
  "TX:conroe":
    "Conroe serves Montgomery County families north of Houston. HHSC licensing records are publicly searchable by facility name at hhs.texas.gov — StarlynnCare surfaces the key findings on each profile.",
  "TX:mckinney":
    "McKinney's rapid growth has added new ALF memory care construction alongside established operators. For newer facilities, compare their first inspection outcomes with recent surveys — the regulatory record tells a different story than marketing materials.",
  "TX:arlington-tx":
    "Arlington sits between Dallas and Fort Worth — a practical option for families splitting commutes between both metros. HHSC LTCR inspection findings and Alzheimer Certification status are indexed for all facilities listed here.",
  "TX:katy":
    "Katy is a west Houston suburb with strong family concentration and a range of ALF memory care pricing tiers. Read HHSC deficiency scope and severity across multiple inspection cycles — single-year snapshots miss operator trends.",
  "TX:denton":
    "Denton serves the north Texas university corridor and anchors comparisons for families between Fort Worth and McKinney. HHSC license type, Alzheimer Certification, and deficiency records are all available on each profile.",
  "TX:garland":
    "Garland sits east of Dallas with generally lower price points than Plano-area alternatives. HHSC LTCR complaint investigation outcomes — separate from routine surveys — are often the most revealing part of the public record.",
  "TX:carrollton":
    "Carrollton bridges Denton and Dallas County families with mid-corridor access. HHSC inspection records here reflect the same public database — compare citation frequency across similar-sized operators before narrowing your list.",
  "TX:lewisville":
    "Lewisville anchors the north Dallas lake corridor. ALF license type (A, B, or C) affects which residents can legally be admitted — read license class alongside Alzheimer Certification and inspection history.",
  "TX:frisco":
    "Frisco is one of Texas's fastest-growing cities with newer ALF construction. Newer facilities may have fewer inspection cycles — read available records carefully and ask operators about deficiency remediation history during tours.",
  "TX:sugar-land":
    "Sugar Land is a southwest Houston suburb with strong family demographics and mid-to-upper market pricing. HHSC scope and severity categories in deficiency reports map to the seriousness of each finding — read the narrative, not just the count.",
  "TX:round-rock":
    "Round Rock serves north Austin families with a growing memory care market. HHSC license class (A, B, or C) determines what level of care a facility can legally provide — pair this with inspection history when evaluating fit.",
  "TX:georgetown":
    "Georgetown is a north Austin suburb with a strong retiree population. HHSC LTCR records for facilities here reflect both routine surveys and complaint investigations — the latter often surfaces family-reported concerns.",
  "TX:allen":
    "Allen sits in Collin County northeast of Plano — a high-demographic suburb with operators at various quality tiers. HHSC Alzheimer Certification and LTCR inspection records are the clearest independent signals for this market.",

  // ── Minnesota ────────────────────────────────────────────────────────────
  "MN:minneapolis":
    "Minneapolis offers a range of ALF with Dementia Care options across city neighborhoods and inner-ring suburbs. MDH licenses these under Chapter 144G — inspection and complaint survey records are indexed on each profile.",
  "MN:st-paul":
    "St. Paul families often cross-compare with Minneapolis and inner-ring suburbs simultaneously. MDH inspection records for Chapter 144G ALF-DC facilities reflect both routine licensing surveys and complaint-driven investigations.",
  "MN:minnetonka":
    "Minnetonka anchors the western Twin Cities suburbs with a concentration of established memory care operators. MDH survey history is the primary public quality signal — read correction orders and civil penalties alongside routine survey outcomes.",
  "MN:rochester":
    "Rochester's medical corridor anchors southeast Minnesota with strong referral networks. MDH ALF-DC inspection records here reflect Chapter 144G standards — compare facilities by correction order frequency and complaint investigation outcomes.",
  "MN:edina":
    "Edina is a high-income south Twin Cities suburb with mid-to-upper market memory care pricing. MDH enforcement records — including correction orders — are the most reliable independent signal for operator consistency.",
  "MN:burnsville":
    "Burnsville anchors the south Metro with a range of pricing tiers and operator sizes. MDH Chapter 144G inspection records and complaint investigation outcomes are indexed on each profile — compare over multiple survey cycles.",
  "MN:duluth":
    "Duluth is the hub for northeastern Minnesota families who often face limited alternatives. MDH licensing records for ALF-DC facilities here reflect both routine surveys and complaint-driven investigations — read the full narrative.",
  "MN:eden-prairie":
    "Eden Prairie combines southwest Metro access with a strong senior housing market. MDH correction order and civil penalty records are the strongest signals of regulatory escalation — compare these across similarly sized operators.",
  "MN:bloomington":
    "Bloomington sits between Minneapolis and the south suburbs — central for families managing multiple commute directions. MDH ALF-DC survey records reflect Chapter 144G standards in effect since August 2021.",
  "MN:blaine":
    "Blaine serves north Metro families between Minneapolis and the St. Cloud corridor. MDH inspection frequency and complaint investigation outcomes for Chapter 144G facilities are indexed on each profile.",

  // ── Pennsylvania ──────────────────────────────────────────────────────────
  "PA:pittsburgh": "Pittsburgh's memory care facilities range from in-city buildings converted for residential use to newer purpose-built campuses in the South Hills and North Hills suburbs. All are regulated by PA DHS OLTL under 55 Pa Code Ch 2600 (Personal Care Home) or Ch 2800 (Assisted Living Residence). Use inspection severity and frequency on each profile to distinguish operators with isolated citations from those with repeated enforcement patterns.",
  "PA:philadelphia": "Philadelphia's memory care supply is concentrated in neighborhoods served by Penn Medicine, Jefferson Health, and Temple affiliates. PA DHS OLTL regulates all licensed Personal Care Homes and Assisted Living Residences in the city under 55 Pa Code. Read each profile's full DHS inspection record — complaint-driven surveys in Philadelphia often reflect staffing volatility that doesn't appear in routine annual surveys alone.",
  "PA:lancaster": "Lancaster city sits at the center of Lancaster County's faith-affiliated care market. Most facilities here are regulated under 55 Pa Code Ch 2600 as Personal Care Homes, with inspection records published by PA DHS OLTL. Compare citation frequency and severity across the county to anchor what a typical inspection record looks like before evaluating any single facility.",
  "PA:allentown": "Allentown anchors Lehigh County's memory care market, with facilities close to Lehigh Valley Hospital. PA DHS OLTL regulates both Personal Care Homes and Assisted Living Residences in the Lehigh Valley under 55 Pa Code. Inspection records are parsed and indexed on each profile — check whether citations cluster around staffing, care planning, or physical environment issues.",
  "PA:york": "York offers a mid-state memory care market between Harrisburg and Baltimore, with a mix of older PCH operators and newer campus builds. PA DHS OLTL inspects all facilities here under 55 Pa Code. Compare peer percentiles to understand how York-area inspection records compare to similar-sized facilities across the state.",
  "PA:west-chester": "West Chester is Chester County's county seat and a hub for Main Line-adjacent memory care. Facilities here range from standalone PCHs to larger continuing care campuses. PA DHS OLTL inspection records for each facility are indexed on StarlynnCare — use the full history, not just the most recent survey, before narrowing your tour list.",
  "PA:harrisburg": "Harrisburg and its suburbs are home to facilities serving central Pennsylvania families, with close access to Penn State Health Milton S. Hershey Medical Center and UPMC Pinnacle. PA DHS OLTL regulates all PCHs and ALRs in the region. Read each profile's deficiency timeline — severity escalations like Provisional License status or Civil Money Penalties are rare but important signals.",
  "PA:erie": "Erie sits in northwestern Pennsylvania with a smaller but distinct memory care market. Facilities here are regulated by PA DHS OLTL under 55 Pa Code Ch 2600 and Ch 2800. Compare inspection frequency and cite dates on each profile, and check whether facilities hold a Special Care or Secure Dementia Care Unit designation in the DHS directory.",
  "PA:king-of-prussia": "King of Prussia anchors the Route 202 / I-76 corridor in Montgomery County, with strong access to Penn Medicine and Jefferson Health affiliates. Several large campus memory care communities operate here alongside standalone PCH facilities. PA DHS inspection records indexed on each profile let you compare regulatory history before scheduling tours.",
  "PA:exton": "Exton sits at the center of Chester County's Route 30 corridor with easy access to Chester County Hospital and Paoli Hospital. Memory care here tends toward newer builds in planned communities. PA DHS inspection records for each Exton-area facility are indexed on StarlynnCare — use the severity breakdown alongside geographic access when prioritizing tours.",
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

// ─────────────────────────────────────────────────────────────────────────────
// County editorial intros — longer-form prose for county hub pages.
// Each entry is an array of paragraph strings rendered verbatim.
// Keys are namespaced as `${STATE_CODE}:${county-slug}`.
// ─────────────────────────────────────────────────────────────────────────────

const COUNTY_INTROS: Record<string, string[]> = {
  "CA:alameda-county": [
    "Alameda County stretches from the Port of Oakland across the East Bay hills to the Tri-Cities of Fremont, Newark, and Union City — one of California\u2019s most geographically and economically diverse care markets. With 93 licensed memory care facilities indexed, it has more CDSS-regulated dementia care capacity than most California counties, spread across fourteen cities and communities that vary sharply in staffing costs, building age, and regulatory history.",
    "Ninety-two of the 93 indexed facilities in Alameda County carry at least one Type-A or Type-B deficiency in their state inspection record. That near-universal rate reflects how thoroughly CDSS documents even minor violations during routine surveys \u2014 but the distribution matters far more than the headline number. A cluster of serious citations concentrated in a single facility\u2019s history looks very different from citations spread thinly across many routine surveys. Every profile on StarlynnCare shows the full deficiency timeline, not just the most recent survey date, so you can distinguish a facility that had one bad year from one with a pattern.",
    "The county\u2019s RCFE market divides roughly into three tiers by geography. Oakland, Berkeley, and Emeryville offer urban density and proximity to UCSF and Alta Bates — useful when a family member has ongoing medical needs that require frequent off-site coordination. Mid-county cities like Hayward, San Leandro, and Castro Valley tend toward medium-sized facilities, often with lower base rates than coastal cities, though level-of-care surcharges can close the gap quickly. The Tri-Valley — Pleasanton, Livermore, Dublin — leans toward newer builds with larger campus footprints and suburban parking-friendly layouts for visiting families.",
    "Medi-Cal does not cover room and board in an RCFE memory care setting. The Assisted Living Waiver (ALW) can cover personal care services in participating Alameda County facilities for residents meeting income and functional eligibility criteria, but the program runs a waitlist and not every licensed RCFE participates. Families exploring ALW coverage should confirm directly with CDSS\u2019s Alameda County contact and verify the facility\u2019s current participation status before making placement decisions. Skilled nursing facilities (SNFs) with secured dementia units operate under a separate license class and do accept Medi-Cal for clinical care; a small number of those are indexed here.",
    "When shortlisting facilities in Alameda County, inspection frequency is as revealing as citation count. Complaint-driven surveys signal that residents or families escalated concerns directly to CDSS \u2014 a different signal than a routine annual visit. StarlynnCare tags complaint-driven inspections on every profile so you can distinguish them from scheduled surveys. Pair that with the peer percentile, which positions each facility against comparable-size RCFE neighbors in the county, and you have enough signal to prioritize tours before you pick up the phone.",
  ],

  // ── Pennsylvania ──────────────────────────────────────────────────────────

  "PA:montgomery-county": [
    "Montgomery County is the largest memory care market in Pennsylvania, with 48 DHS-licensed facilities indexed across 29 communities — from the Philadelphia Main Line suburbs like Haverford and Bala Cynwyd to the Route 422 corridor through King of Prussia, Lansdale, and Pottstown. The county's concentration of health system affiliates, retirement communities, and standalone memory care buildings reflects a market shaped by Philadelphia's medical corridor and suburban demand from a county of 860,000 residents.",
    "PA DHS OLTL regulates all Montgomery County Personal Care Homes (PCH) and Assisted Living Residences (ALR) under 55 Pa Code Chapters 2600 and 2800. DHS inspection PDFs for each facility are parsed and indexed on StarlynnCare. When reviewing profiles, focus on the frequency of Civil Money Penalty citations and Provisional License downgradings — these represent escalated enforcement action beyond a standard correctable citation, and they signal a DHS finding serious enough to warrant financial penalty or license suspension.",
    "The county divides into geographic sub-markets that affect price, visiting logistics, and operator mix. The lower Montgomery corridor — Abington, Dresher, Wyncote, Willow Grove — runs along Route 309 and the Pennsylvania Turnpike, close to Jefferson Abington Hospital and easy for families commuting from Northeast Philadelphia. The Lansdale-North Wales-Souderton cluster serves the Route 309 north corridor and tends to have a higher proportion of faith-affiliated operators. King of Prussia, Blue Bell, and Plymouth Meeting form a dense western corridor near the Turnpike interchange with strong staffing access and newer campus builds.",
    "Pennsylvania Medicaid (Medical Assistance) does not cover room and board in a PCH or ALR. The Personal Care Services (PCS) and Attendant Care programs under PA MA can fund personal care services at participating facilities for eligible residents, but not the facility's room and board base rate. The LIFE program (Living Independently for Elders), available through licensed LIFE organizations in the Philadelphia region, provides HCBS-equivalent coverage for eligible residents who meet nursing-facility level of care — but operates as a managed care program, not a fee-for-service waiver. Confirm PA MA participation and LIFE enrollment status directly with each facility during your tour.",
    "When comparing facilities in Montgomery County, cross-reference the inspection date range shown on each profile with the facility's years in operation. A facility licensed five years ago with five clean inspections is a different risk profile from one with a 20-year history that includes two Provisional License downgrades. Every PA DHS citation references a specific 55 Pa Code section — use that to identify whether citations cluster around staffing, care planning, or physical environment issues before you schedule a tour.",
  ],

  "PA:allegheny-county": [
    "Allegheny County anchors the Pittsburgh metro memory care market, with 44 PA DHS-indexed facilities spread across Pittsburgh's neighborhoods and a ring of established suburbs — Bethel Park, Mt. Lebanon, Upper St. Clair, Wexford, and Allison Park to the south and north. The county's market is defined by strong regional health systems (UPMC, AHN), an older residential housing stock in the city, and suburban communities with newer purpose-built memory care campuses in the North Hills and South Hills corridors.",
    "PA DHS OLTL inspects Allegheny County PCHs and ALRs on roughly annual cycles. DHS issues citations under 55 Pa Code Ch 2600 (PCH) or Ch 2800 (ALR), with enforcement escalating from correctable citations to Civil Money Penalties, Provisional License status, and in severe cases, license revocation. StarlynnCare parses and indexes every DHS inspection PDF for each Allegheny County facility — read the severity breakdown on each profile before narrowing your tour list.",
    "Pittsburgh's in-city facilities tend toward smaller footprints and older buildings converted from residential stock. The South Hills suburbs — Mt. Lebanon, Bethel Park, Upper St. Clair, Jefferson Hills — offer newer builds with suburban parking and lower-density visit logistics. The North Hills corridor — Wexford, Allison Park, Cheswick, Warrendale — has seen new development in the past decade, with several purpose-built memory care campuses along the Route 19 and I-79 corridors. Monroeville anchors the eastern suburbs with access to Forbes and UPMC East facilities for medical coordination.",
    "Pennsylvania Medicaid room-and-board exclusion applies here as in every PA county: MA funds services, not the facility base rate. Families with loved ones who meet nursing-facility level of care should ask each facility about their PA MA Waiver participation and LIFE program enrollment availability. Not every Allegheny County PCH or ALR participates in state funding programs — verifying this early avoids placement disruptions later.",
    "Allegheny County's inspection record spans PCHs and ALRs, and the two license types attract different oversight patterns. ALRs typically have more complex residents with higher care needs, so DHS surveys tend to focus more heavily on medication management, nursing oversight, and care plan documentation. PCHs face scrutiny around staffing levels, resident assessment accuracy, and physical environment maintenance. Read the 55 Pa Code citation sections in each profile to understand which regulatory domain drove the inspection findings.",
  ],

  "PA:bucks-county": [
    "Bucks County sits northeast of Philadelphia along the Delaware River, with 29 PA DHS-indexed facilities spread across communities from Bensalem and Langhorne near the I-95 corridor to Doylestown, Newtown, and Yardley further north. The county's market reflects suburban Philadelphia family patterns: dense along the Route 1 and Turnpike corridors near Philadelphia, more rural in the northern reaches near Quakertown and Sellersville.",
    "PA DHS OLTL regulates Bucks County PCHs and ALRs, with inspection PDFs parsed and indexed on StarlynnCare. The county has a meaningful number of faith-affiliated operators — particularly in Doylestown, Lansdale, and the Telford-Souderton corridor — alongside secular assisted living operators. Read the specific 55 Pa Code citations and their frequency across inspection years, not just the most recent survey, to assess operator consistency.",
    "The Route 1 corridor from Bensalem north through Langhorne and Southampton has the county's densest memory care concentration, close to Aria Health and Jefferson Bucks. The New Hope-Doylestown-Yardley triangle serves higher-income demographics with larger campus facilities and longer waitlists; these facilities tend to have higher base rates and more robust private-pay programming. Warminster and Warrington provide a mid-county option close to Doylestown Hospital and with easy I-276 access for Philadelphia-area families.",
    "For families exploring PA Medicaid: Bucks County is served by multiple managed care organizations under HealthChoices, Pennsylvania's mandatory managed care program. A PCH or ALR resident who qualifies for MA-funded personal care services will receive them through an MCO enrollment, not fee-for-service DHS. Verify each facility's MCO participation status before assuming MA coverage will transfer. The LIFE program is less available in Bucks County than in Philadelphia — confirm with each prospective facility.",
  ],

  "PA:chester-county": [
    "Chester County is a high-income suburban market west of Philadelphia along the Main Line, with 26 PA DHS-indexed facilities across 14 communities — from Wayne, Paoli, and Devon along Route 30 to West Chester, Exton, and Downingtown further west. The county has a high concentration of continuing care retirement communities (CCRCs) that include memory care units within larger campus settings, alongside standalone PCH and ALR memory care buildings.",
    "PA DHS OLTL inspects Chester County facilities under 55 Pa Code Ch 2600 and Ch 2800. Read the full inspection history on each profile: facilities embedded in CCRCs sometimes have different citation patterns than standalone memory care buildings — CCRC operators often have larger compliance teams but also more complex staffing structures that DHS surveys scrutinize for care plan coordination failures.",
    "The Main Line corridor — Wayne, Paoli, Devon — has the county's highest concentration of facilities, with strong access to Penn Medicine affiliates. West Chester, the county seat, anchors a growing mid-county cluster near Chester County Hospital and I-202. The Exton-Downingtown corridor has seen new development and offers alternatives for families commuting from Lancaster or Coatesville. Kennett Square and West Grove serve the southern county and tend toward smaller-footprint PCHs.",
    "Pennsylvania PACE organizations and LIFE programs have limited reach in Chester County outside the Philadelphia suburban corridor. Families considering PA MA funding should clarify waiver availability early — a facility's private-pay rate does not indicate MA participation, and Chester County's higher-income market means some operators have limited MA participation by design. Confirm payer mix directly with each facility's admissions staff during your first conversation.",
  ],

  "PA:lancaster-county": [
    "Lancaster County is a distinct market — geographically and demographically — from the Philadelphia suburbs. With 19 PA DHS-indexed facilities concentrated in Lancaster city, Lititz, Ephrata, and Manheim, the county's memory care supply reflects its older population, strong faith-affiliated operator presence, and Pennsylvania Dutch country rural character. Many operators here have served the county for decades, with inspection histories that span DHS's shift from older PCH regulations to the current Chapter 2600 and 2800 framework.",
    "PA DHS OLTL regulates Lancaster County PCHs and ALRs with the same inspection framework as the rest of the state. The county has a notable concentration of Mennonite and faith-affiliated operators — organizations like Landis Homes, Garden Spot Village, and Moravian Manor have long histories and strong community roots. Read DHS inspection records carefully: long-tenured operators with good community reputations still generate citations, and the DHS record is the most reliable signal beyond marketing materials.",
    "Lancaster city itself has a small but dense cluster of facilities close to Penn Medicine Lancaster General Hospital. The Route 501 corridor — Lititz, Manheim, Maytown — serves northern Lancaster County with several mid-sized PCH operators. Quarryville and Millersville serve the southern and western portions of the county. Families from outside Lancaster County should factor distance from Philadelphia or Harrisburg into visit logistics — I-76 provides connection but traffic patterns can affect visit frequency.",
    "Lancaster County's Medicaid landscape is served primarily by HealthChoices MCOs active in the South Central PA region. Faith-affiliated operators in Lancaster County often have specific payer policies shaped by their organizational mission — some participate actively in MA waiver programs, others do not. Confirm payer participation early in your evaluation rather than after a facility has become the family's preferred choice.",
  ],

  "PA:delaware-county": [
    "Delaware County sits immediately southwest of Philadelphia, with 16 PA DHS-indexed facilities concentrated in Bryn Mawr, Haverford, Newtown Square, Media, and Rosemont — the western Main Line and inner-ring suburban corridor. The county's tight geography means families can often compare multiple facilities within a 15-minute drive, but competition for beds at well-regarded operators can create waitlists in a market where demand consistently tracks supply.",
    "PA DHS OLTL inspects Delaware County PCHs and ALRs under 55 Pa Code Chapters 2600 and 2800. The county has a mix of standalone memory care facilities and memory care units embedded within larger continuing care communities. When reviewing profiles, check whether the facility operates as a standalone PCH, a standalone ALR, or as a memory care unit within a larger campus — the DHS inspection framework applies to the licensed unit, but management quality, staffing depth, and family access policies differ across these models.",
    "Bryn Mawr and Haverford anchor the high-demand corridor close to Bryn Mawr Hospital and Main Line Health. Newtown Square and Media offer slightly lower price points with comparable access to health systems. Rosemont and the northern parts of the county provide proximity to Drexel Hill and Upper Darby communities that feed Delaware County's care market. Access to Jefferson, Penn Medicine, and ChristianaCare affiliates makes this county a strong choice for residents with complex ongoing medical needs.",
    "Delaware County's small geography means that inspection frequency and complaint-investigation volume on each profile is a useful differentiator — with 16 facilities in a tight area, a facility that generates repeated complaint-driven surveys stands out more clearly than in a larger county. Use the full inspection timeline on each profile, not the most recent year's summary, before scheduling tours.",
  ],
};

/**
 * Returns an array of editorial paragraph strings for a county hub page,
 * or null if no custom content has been authored for this county.
 */
export function countyIntroParasForRegion(
  stateCode: string,
  countySlug: string,
): string[] | null {
  const key = `${stateCode.toUpperCase()}:${countySlug.toLowerCase()}`;
  return COUNTY_INTROS[key] ?? null;
}
