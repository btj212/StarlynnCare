import type { Region } from "@/lib/regions";
import { canonicalFor } from "@/lib/seo/canonical";
import { formatCostRange } from "@/lib/content/stateCostBands";

export interface CityFaqInputs {
  totalCount: number;
  /** Facilities with at least one serious finding in indexed data */
  facilitiesWithDeficiency: number;
}

export interface FaqPair {
  q: string;
  a: string;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

// ─── State-specific helpers ───────────────────────────────────────────────────

interface StateStrings {
  costRange: (cityName: string, isCounty: boolean) => string;
  licenseQ: string;
  licenseA: string;
  facilityVsNursingQ: string;
  facilityVsNursingA: string;
  deficiencyLabel: string;
  medicaidQ: (cityName: string) => string;
  medicaidA: (cityName: string) => string;
}

function getStateStrings(stateCode: string): StateStrings {
  const code = stateCode.toUpperCase();

  if (code === "OR") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Memory care across ${city} typically runs ${formatCostRange("OR", "county")} for an ALF or RCF with an Oregon DHS Memory Care Endorsement. Rates vary by room type, level-of-care tier, and operator. Full monthly bills often exceed the advertised base rate.`
          : `Memory care in ${city} typically runs ${formatCostRange("OR", "city")} for an Oregon-licensed ALF or RCF with a Memory Care Endorsement, depending on room type and care level. The full bill nearly always exceeds the advertised base rate.`,
      licenseQ: `What makes a facility "memory care" in Oregon?`,
      licenseA: `Oregon has a specific Memory Care Endorsement issued by the Department of Human Services (DHS), Long-Term Care Licensing. Facilities here are licensed as Assisted Living Facilities (ALFs) or Residential Care Facilities (RCFs) under ORS ch. 443. To carry the endorsement, a facility must meet additional staff training standards, have secured environments where clinically appropriate, and provide individualized dementia programming. Endorsement status appears on every StarlynnCare profile and is sourced from the DHS public licensing portal.`,
      facilityVsNursingQ: `What's the difference between an ALF and a nursing home in Oregon?`,
      facilityVsNursingA: `Oregon ALFs and RCFs provide non-medical residential care — room, board, ADL assistance, medication management. Nursing facilities (NFs) provide skilled nursing care with licensed nurses on staff 24/7 for residents needing medical-level support. If your family member requires IV medications, wound care, or complex medical management, a nursing facility may be more appropriate than a memory-care ALF.`,
      deficiencyLabel: "licensing violation or abuse investigation",
      medicaidQ: (city) => `Does Oregon Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Oregon Health Plan (Medicaid) can cover care in a DHS-contracted ALF or RCF through the Medicaid Long-Term Care program, but not all facilities hold Medicaid contracts. Eligibility, available beds, and waitlists vary. Each StarlynnCare profile notes Medicaid acceptance status where documented in the DHS roster. Contact Oregon DHS at 1-800-282-8096 for current contract and availability information in ${city}.`,
    };
  }

  if (code === "WA") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Memory care across ${city} typically runs ${formatCostRange("WA", "county")} for an ALF holding a Washington DSHS Specialized Dementia Care contract. Rates vary by region, room type, and level-of-care tier.`
          : `Memory care in ${city} typically runs ${formatCostRange("WA", "city")} for an ALF with a Washington DSHS Specialized Dementia Care contract. Full monthly costs often exceed the advertised base rate by $500–$2,000 depending on care level.`,
      licenseQ: `What makes a facility "memory care" in Washington?`,
      licenseA: `Washington state licenses memory care communities as Assisted Living Facilities (ALFs) regulated by DSHS Aging and Disability Services Administration (ADSA), Residential Care Services. Facilities here hold a <strong>Specialized Dementia Care contract</strong> with DSHS — a contract tier requiring specialized staff training in dementia care techniques, behavioral support protocols, and enhanced supervision standards. Contract status appears on every StarlynnCare profile and is sourced from the DSHS public lookup.`,
      facilityVsNursingQ: `What's the difference between an ALF and a nursing home in Washington?`,
      facilityVsNursingA: `Washington ALFs provide residential care — room, board, personal assistance, and medication management — in a community setting. Nursing homes (Skilled Nursing Facilities) provide licensed medical nursing care 24/7 for residents needing IV therapy, wound care, or complex medication management. Dementia care ALFs are appropriate for residents who need memory-specific programming but not continuous skilled nursing.`,
      deficiencyLabel: "inspection or investigation finding",
      medicaidQ: (city) => `Does Apple Health (Medicaid) cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Washington Apple Health (Medicaid) can cover care in contracted ALFs through the Community Options Program Entry System (COPES) and other waiver programs, but not all facilities hold Medicaid contracts and waitlists exist. Eligibility depends on functional and financial criteria. Each StarlynnCare profile notes contract status where documented. Contact DSHS at 1-800-422-3263 for current contract and availability information in ${city}.`,
    };
  }

  if (code === "TX") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Memory care across ${city} typically runs ${formatCostRange("TX", "county")} for a Texas-licensed Assisted Living Facility (Type A or B) holding HHSC Alzheimer's Disease and Related Disorders certification. Rates vary by metro, room type, and care level.`
          : `Memory care in ${city} typically runs ${formatCostRange("TX", "city")} for a Texas Type B ALF with HHSC Alzheimer's certification, depending on room type and care level. Full monthly bills nearly always exceed the advertised base rate.`,
      licenseQ: `What makes a facility "memory care" in Texas?`,
      licenseA: `Texas licenses memory care communities as Assisted Living Facilities (ALFs) under Texas Health & Safety Code ch. 247, regulated by HHSC Long-Term Care Regulation (LTCR). Most Texas memory care lives in <strong>Type B ALFs</strong> (for residents who cannot evacuate without assistance) carrying the optional <strong>Alzheimer's Disease and Related Disorders certification</strong> — a separate HHSC designation requiring dementia-specific staff training, secured environments where clinically indicated, and individualized programming. Type C is reserved for adult foster homes (≤4 residents). License type and Alzheimer's certification status appear on every StarlynnCare profile and are sourced from the HHSC public licensing portal.`,
      facilityVsNursingQ: `What's the difference between an ALF and a nursing facility in Texas?`,
      facilityVsNursingA: `Texas ALFs provide non-medical residential care — room, board, ADL assistance, medication administration by trained staff. Nursing facilities (NFs, also called nursing homes or skilled nursing facilities) provide licensed nursing care 24/7 for residents needing IV therapy, complex wound care, or continuous medical management. If your family member needs ongoing skilled medical care, a Texas NF or SNF may be more appropriate than a memory-care ALF.`,
      deficiencyLabel: "HHSC inspection or complaint finding",
      medicaidQ: (city) => `Does Texas Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Traditional Texas Medicaid does not pay ALF room and board. The <strong>STAR+PLUS</strong> waiver program — Texas Medicaid managed care for elderly and disabled adults — can cover certain personal care and HCBS services in a participating ALF, but room-and-board costs remain the family's responsibility and waitlists exist. Eligibility depends on functional and financial criteria. Each StarlynnCare profile notes Medicaid acceptance where documented in HHSC data. Contact 211 Texas (dial 2-1-1) or the Texas HHSC Aging and Disability Resource Center for current options in ${city}.`,
    };
  }

  if (code === "MN") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Memory care across ${city} typically runs ${formatCostRange("MN", "county")} for a licensed Assisted Living Facility with Dementia Care under Minnesota Statutes ch. 144G. Rates vary by city, room type, and care level tier.`
          : `Memory care in ${city} typically runs ${formatCostRange("MN", "city")} for a licensed ALF with Dementia Care under Minnesota ch. 144G, depending on room type and care level.`,
      licenseQ: `What makes a facility "memory care" in Minnesota?`,
      licenseA: `Minnesota's 2019 Assisted Living Licensure Reform (Minn. Stat. ch. 144G) created a specific <strong>Assisted Living Facility with Dementia Care</strong> license tier, regulated by the Minnesota Department of Health (MDH). Facilities at this tier must meet enhanced requirements: dementia-trained staff at all times, individualized dementia programming, and secured environments where clinically indicated. License tier appears on every StarlynnCare profile and is sourced from the MDH public licensing directory.`,
      facilityVsNursingQ: `What's the difference between an ALF with Dementia Care and a nursing home in Minnesota?`,
      facilityVsNursingA: `Minnesota ALFs with Dementia Care provide residential personal care and dementia programming in a community setting. Nursing homes (Skilled Nursing Facilities certified under Title 18/19) provide licensed medical nursing around the clock for residents needing medical-level care. If your family member requires complex wound care, IV therapy, or continuous medical monitoring, a nursing facility may be more appropriate.`,
      deficiencyLabel: "inspection or complaint finding",
      medicaidQ: (city) => `Does Minnesota Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Minnesota Medical Assistance (Medicaid) can cover care in a licensed ALF with Dementia Care through the Consumer Support Grant or the Elderly Waiver (EW) program, but not all facilities are Medicaid-enrolled and waitlists exist. Each StarlynnCare profile notes payment acceptance where known. Contact Minnesota Senior LinkAge Line at 1-800-333-2433 for guidance on options in ${city}.`,
    };
  }

  // California (default)
  const costGuideUrl = canonicalFor("/california/cost-guide");
  const alwUrl = "https://www.cdss.ca.gov/assisted-living-waiver";
  return {
    costRange: (city, isCounty) =>
      isCounty
        ? `Memory care across ${city} runs from roughly $4,500/month at smaller RCFEs in lower-cost cities to $12,000+/month at premium memory-specific buildings. Median sits around $6,500–$8,000/month for a private room with standard care needs. Full bills almost always exceed the advertised base rate; most California facilities use "level of care" point systems adding $500–$2,500/month. Click into any city below for a tighter range, or read What memory care costs in California (${costGuideUrl}).`
        : `Memory care in ${city} typically runs $5,000–$9,000/month, depending on level of care, room type, and licensing tier. The full bill almost always exceeds the advertised base rate. Most California facilities use "level of care" point systems adding $500–$2,500/month for residents needing more support with bathing, medication, or mobility. For statewide ranges and financing context, see What memory care costs in California (${costGuideUrl}).`,
    licenseQ: `What makes a facility "memory care" in California?`,
    licenseA: `California has no separate memory care license. The facilities here are CDSS-licensed Residential Care Facilities for the Elderly (RCFEs) under Section 1569 of the Health & Safety Code. To advertise as memory care, an RCFE files a Memory Care Disclosure with CDSS and meets additional requirements around staff training, secured perimeters, and dementia programming. Some facilities here are skilled nursing facilities (SNFs) with a dementia or secure unit — a different license entirely (Title 22, Division 5). License type appears on every StarlynnCare profile.`,
    facilityVsNursingQ: `What's the difference between an RCFE and a nursing home?`,
    facilityVsNursingA: `RCFEs provide non-medical care: room, board, supervision, ADL help, medication assistance. Nursing homes (SNFs) provide medical care: licensed nurses on staff 24/7, medication administration (not just assistance), wound care, rehab. Most California memory care indexed here lives in RCFEs. If your family member needs ongoing skilled nursing — feeding tubes, IV medications, complex wound care — an RCFE memory unit may not fit.`,
    deficiencyLabel: "Type-A or Type-B deficiency from CDSS",
    medicaidQ: (city) => `Does Medi-Cal cover memory care in ${city}?`,
    medicaidA: (city) =>
      `Traditional Medi-Cal does not cover room and board in an RCFE memory care setting. The Assisted Living Waiver (ALW) can cover services in participating RCFEs for income-qualified residents, but waitlists are long and the program runs in a limited set of counties — whether ${city} is in an ALW service area depends on county (see ${alwUrl}). Medi-Cal does cover skilled nursing care in a Medi-Cal-certified SNF, including SNF dementia units, for residents meeting medical eligibility. Each facility profile documents payment acceptance when known.`,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Q&A pairs for city/county hub pages — state-aware.
 * Matches the visible FAQ section and FAQPage JSON-LD.
 */
export function buildCityFaqs(region: Region, inputs: CityFaqInputs): FaqPair[] {
  const { totalCount, facilitiesWithDeficiency } = inputs;
  const severePct = pct(facilitiesWithDeficiency, totalCount);
  const cityName = region.name;
  const isCounty = region.kind === "county";
  const stateCode = region.state.code;

  const s = getStateStrings(stateCode);
  // CA has a state-specific deeper version with RCFE/Medi-Cal framing; all other
  // states link to the universal /library/ checklist that translates across regulators.
  const resolvedTourUrl = canonicalFor(
    stateCode === "CA"
      ? "/california/37-questions-to-ask-on-a-tour"
      : "/library/37-questions-to-ask-on-a-memory-care-tour",
  );

  return [
    {
      q: isCounty
        ? `How much does memory care cost across ${cityName}?`
        : `How much does memory care cost in ${cityName}?`,
      a: s.costRange(cityName, isCounty),
    },
    {
      q: s.licenseQ,
      a: s.licenseA,
    },
    {
      q: s.facilityVsNursingQ,
      a: s.facilityVsNursingA,
    },
    {
      q: `How many ${cityName} facilities have a serious deficiency on file?`,
      a:
        totalCount === 0
          ? `StarlynnCare has not yet indexed publishable facilities for ${cityName}.`
          : `Of the ${totalCount} licensed memory care facilities indexed in ${cityName}, ${facilitiesWithDeficiency} (${severePct}%) carry a documented ${s.deficiencyLabel} in the indexed inspection record. Specific findings appear on each profile with inspection date and source link. StarlynnCare sources all deficiency data directly from state regulator records — no facility-side surveys or paid submissions are used. See the <a href="${canonicalFor("/methodology")}" class="text-teal underline underline-offset-4">methodology</a> for how deficiency classes are mapped across states.`,
    },
    {
      q: `How does StarlynnCare rank memory care facilities in ${cityName}?`,
      a: `StarlynnCare does not assign a single letter grade. Instead, each profile shows four independent signals derived from state inspection records: deficiency severity (Type-A vs. Type-B in California, equivalent classes in other states), repeat citation rate, inspection frequency relative to peers, and trajectory over time. Facilities with too few inspections on record show a "limited history" notice rather than a misleading score. All underlying data is sourced from mandatory public records — CDSS for California, HHSC LTCR for Texas, DHS for Oregon, and equivalent agencies for other states. Full methodology is at <a href="${canonicalFor("/methodology")}" class="text-teal underline underline-offset-4">starlynncare.com/methodology</a>.`,
    },
    {
      q: `What should I look for on a memory care tour in ${cityName}?`,
      a: `What predicts safety usually isn't what admissions directors highlight. From clinician and family interviews, the most under-asked items: staff-to-resident ratio at night and on weekends, skin-check and wound-prevention protocol, medication management and error reporting, shower frequency, and how the facility handles behavioral escalation. We publish a free 37-question tour checklist you can print (${resolvedTourUrl}).`,
    },
    {
      q: s.medicaidQ(cityName),
      a: s.medicaidA(cityName),
    },
  ];
}
