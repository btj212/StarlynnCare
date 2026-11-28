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
  /** Plural noun used in "Of the N ___ indexed in City". */
  indexedNoun: string;
  medicaidQ: (cityName: string) => string;
  medicaidA: (cityName: string) => string;
}

function getStateStrings(stateCode: string): StateStrings {
  const code = stateCode.toUpperCase();

  if (code === "OR") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `A regional benchmark for memory care across ${city} is ${formatCostRange("OR", "county")} for an ALF or RCF with an Oregon DHS Memory Care Endorsement. That is not a local median. Rates vary by room type, level-of-care tier, and operator.`
          : `A regional benchmark for memory care in ${city} is ${formatCostRange("OR", "city")} for an Oregon-licensed ALF or RCF with a Memory Care Endorsement. That is not a ${city} median — ask each home for its current rate.`,
      licenseQ: `What makes a facility "memory care" in Oregon?`,
      licenseA: `Oregon has a specific Memory Care Endorsement issued by the Department of Human Services (DHS), Long-Term Care Licensing. Facilities here are licensed as Assisted Living Facilities (ALFs) or Residential Care Facilities (RCFs) under ORS ch. 443. To carry the endorsement, a facility must meet additional staff training standards, have secured environments where clinically appropriate, and provide individualized dementia programming. Endorsement status appears on every StarlynnCare profile and is sourced from the DHS public licensing portal.`,
      facilityVsNursingQ: `What's the difference between an ALF and a nursing home in Oregon?`,
      facilityVsNursingA: `Oregon ALFs and RCFs provide non-medical residential care — room, board, ADL assistance, medication management. Nursing facilities (NFs) provide skilled nursing care with licensed nurses on staff 24/7 for residents needing medical-level support. If your family member requires IV medications, wound care, or complex medical management, a nursing facility may be more appropriate than a memory-care ALF.`,
      deficiencyLabel: "licensing violation or abuse investigation",
      indexedNoun: "memory care endorsed homes",
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
      licenseA: `Washington DSHS licenses assisted living facilities and adult family homes. A <strong>Specialized Dementia Care contract</strong> is a separate DSHS contract — not the default license — requiring dementia-specific staff training and enhanced supervision. Only homes with that contract (or a Memory Care Certified designation when DSHS publishes it) are labeled memory care on StarlynnCare. Most listed Washington homes do not hold the contract.`,
      facilityVsNursingQ: `What's the difference between an ALF and a nursing home in Washington?`,
      facilityVsNursingA: `Washington ALFs provide residential care — room, board, personal assistance, and medication management — in a community setting. Nursing homes (Skilled Nursing Facilities) provide licensed medical nursing care 24/7 for residents needing IV therapy, wound care, or complex medication management. Dementia care ALFs are appropriate for residents who need memory-specific programming but not continuous skilled nursing.`,
      deficiencyLabel: "inspection or investigation finding",
      indexedNoun: "homes that serve people with dementia",
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
      indexedNoun: "Alzheimer-certified assisted living facilities",
      medicaidQ: (city) => `Does Texas Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Traditional Texas Medicaid does not pay ALF room and board. The <strong>STAR+PLUS</strong> waiver program — Texas Medicaid managed care for elderly and disabled adults — can cover certain personal care and HCBS services in a participating ALF, but room-and-board costs remain the family's responsibility and waitlists exist. Eligibility depends on functional and financial criteria. Each StarlynnCare profile notes Medicaid acceptance where documented in HHSC data. Contact 211 Texas (dial 2-1-1) or the Texas HHSC Aging and Disability Resource Center for current options in ${city}.`,
    };
  }

  if (code === "MN") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `A regional benchmark for memory care across ${city} is ${formatCostRange("MN", "county")} for a licensed Assisted Living Facility with Dementia Care under Minnesota Statutes ch. 144G. That is not a local median. Rates vary by city, room type, and care level tier.`
          : `A regional benchmark for memory care in ${city} is ${formatCostRange("MN", "city")} for a licensed ALF with Dementia Care under Minnesota ch. 144G. That is not a ${city} median — ask each home for its current rate.`,
      licenseQ: `What makes a facility "memory care" in Minnesota?`,
      licenseA: `Minnesota's 2019 Assisted Living Licensure Reform (Minn. Stat. ch. 144G) created a specific <strong>Assisted Living Facility with Dementia Care</strong> license tier, regulated by the Minnesota Department of Health (MDH). Facilities at this tier must meet enhanced requirements: dementia-trained staff at all times, individualized dementia programming, and secured environments where clinically indicated. License tier appears on every StarlynnCare profile and is sourced from the MDH public licensing directory.`,
      facilityVsNursingQ: `What's the difference between an ALF with Dementia Care and a nursing home in Minnesota?`,
      facilityVsNursingA: `Minnesota ALFs with Dementia Care provide residential personal care and dementia programming in a community setting. Nursing homes (Skilled Nursing Facilities certified under Title 18/19) provide licensed medical nursing around the clock for residents needing medical-level care. If your family member requires complex wound care, IV therapy, or continuous medical monitoring, a nursing facility may be more appropriate.`,
      deficiencyLabel: "inspection or complaint finding",
      indexedNoun: "licensed ALFs with dementia care",
      medicaidQ: (city) => `Does Minnesota Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Minnesota Medical Assistance (Medicaid) can cover care in a licensed ALF with Dementia Care through the Consumer Support Grant or the Elderly Waiver (EW) program, but not all facilities are Medicaid-enrolled and waitlists exist. Each StarlynnCare profile notes payment acceptance where known. Contact Minnesota Senior LinkAge Line at 1-800-333-2433 for guidance on options in ${city}.`,
    };
  }

  if (code === "PA") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Memory care across ${city} typically runs ${formatCostRange("PA", "county")} for a licensed Personal Care Home or Assisted Living Residence with a DHS Special Care designation. Rates vary by room type, care level, and operator.`
          : `Memory care in ${city} typically runs ${formatCostRange("PA", "city")} for a PA DHS OLTL-licensed PCH or ALR with Special Care programming, depending on room type and care level.`,
      licenseQ: `What makes a facility "memory care" in Pennsylvania?`,
      licenseA: `Pennsylvania licenses Personal Care Homes (55 Pa Code Ch 2600) and Assisted Living Residences (Ch 2800). A <strong>Special Care</strong> or <strong>Secure Dementia Care Unit</strong> designation is a DHS-recorded dementia signal — not a marketing claim — and appears on the profile only when it is on the state file. Many listed homes serve people with dementia under a standard PCH or ALR license.`,
      facilityVsNursingQ: `What's the difference between memory care and a nursing home in Pennsylvania?`,
      facilityVsNursingA: `PA DHS-licensed PCHs and ALRs provide residential personal care and dementia programming. Nursing homes (Skilled Nursing Facilities) are regulated by PA DOH and CMS, provide 24-hour licensed nursing, and operate under a separate inspection framework. If your family member needs continuous skilled nursing, wound care, or IV therapy, a nursing facility may be more appropriate.`,
      deficiencyLabel: "severe finding (PA DHS severity ≥ 3, including substantiated abuse)",
      indexedNoun: "personal care and assisted living homes",
      medicaidQ: (city) => `Does Pennsylvania Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Pennsylvania Medicaid (Medical Assistance) does not pay room and board in a PCH or ALR. MA can fund personal care services through HealthChoices managed care organizations for eligible residents, but not the daily base rate. Nursing homes certified for Medicaid do accept MA for clinical care and room and board. Each StarlynnCare profile notes payment acceptance where documented. Contact your county Area Agency on Aging for options in ${city}.`,
    };
  }

  if (code === "IL") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Memory care across ${city} typically runs ${formatCostRange("IL", "county")} for an IDPH-licensed Assisted Living Establishment with a confirmed dementia or memory care focus. Rates vary by room type and care level.`
          : `Memory care in ${city} typically runs ${formatCostRange("IL", "city")} for an IDPH-regulated ALE or Shared Housing Establishment with dementia-specific programming.`,
      licenseQ: `What makes a facility "memory care" in Illinois?`,
      licenseA: `Illinois regulates Assisted Living Establishments (ALEs) and Shared Housing Establishments (SHEs) under IDPH 77 Ill. Adm. Code Part 295. StarlynnCare indexes only facilities with a confirmed memory care or dementia focus — identified by name keywords or a portal-confirmed dementia special-care unit. License type and violation history appear on every StarlynnCare profile.`,
      facilityVsNursingQ: `What's the difference between an ALE and a nursing home in Illinois?`,
      facilityVsNursingA: `Illinois ALEs and SHEs provide residential personal care in a community setting. Skilled nursing facilities are regulated by IDPH and CMS under a separate framework, with 24-hour licensed nursing for residents needing medical-level care. If your family member requires complex wound care, IV therapy, or continuous medical monitoring, a nursing facility may be more appropriate.`,
      deficiencyLabel: "Type 1, 2, or 3 violation",
      indexedNoun: "assisted living establishments with a dementia focus",
      medicaidQ: (city) => `Does Illinois Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Illinois Medicaid can cover certain supportive services in participating assisted living settings through waiver programs, but room and board in an ALE are typically the family's responsibility. Not all facilities accept Medicaid-funded residents. Each StarlynnCare profile notes payment acceptance where documented. Contact the Illinois Department of Healthcare and Family Services or your county AAA for current options in ${city}.`,
    };
  }

  if (code === "UT") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Memory care across ${city} typically runs ${formatCostRange("UT", "county")} for a Utah DLBC-licensed Type I or Type II Assisted Living Facility. Rates vary by metro, room type, and care level.`
          : `Memory care in ${city} typically runs ${formatCostRange("UT", "city")} for a DLBC-licensed ALF under Utah Admin. Code R432-270, depending on room type and care level.`,
      licenseQ: `What makes a facility "memory care" in Utah?`,
      licenseA: `Utah licenses memory care communities as Type I or Type II Assisted Living Facilities regulated by the Division of Licensing and Background Checks (DLBC) under Utah Admin. Code R432-270. Type II ALFs serve residents who need physical assistance with transfers and a higher level of personal care — including many residents with moderate-to-advanced dementia. License type appears on every StarlynnCare profile.`,
      facilityVsNursingQ: `What's the difference between an ALF and a nursing home in Utah?`,
      facilityVsNursingA: `Utah ALFs provide residential care — room, board, personal assistance, and medication management. Nursing facilities provide licensed nursing care 24/7 for residents needing IV therapy, wound care, or continuous medical management. CMS-regulated nursing facilities operate under a separate inspection record from DLBC-licensed ALFs.`,
      deficiencyLabel: "DLBC inspection or complaint finding",
      indexedNoun: "licensed assisted living facilities",
      medicaidQ: (city) => `Does Utah Medicaid cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Utah Medicaid can cover certain services in participating ALFs through Home and Community-Based Services waiver programs, but room and board are typically not covered. Not all facilities hold Medicaid contracts. Each StarlynnCare profile notes payment acceptance where documented. Contact the Utah Department of Health and Human Services for current options in ${city}.`,
    };
  }

  if (code === "CO") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `CDPHE does not publish monthly rates for assisted living in ${city}. Ask each home for its current price. An assisted living residence and a nursing home are priced under different rules.`
          : `CDPHE does not publish a monthly rate for assisted living in ${city}. The price you hear on a tour is the home's own quote, not a state figure.`,
      licenseQ: `What makes a facility "memory care" in Colorado?`,
      licenseA: `Colorado does not issue a separate memory-care license. Assisted living residences are licensed by CDPHE under 6 CCR 1011-1 Chapter 7. A secure environment is optional, and CDPHE does not publish a list of homes that have one. Dementia training is required for every assisted living residence, so training alone is not a memory-care designation. StarlynnCare lists a home as memory care only when the name, a verified chain, or two independent directories say so. That is not a CDPHE certificate.`,
      facilityVsNursingQ: `What's the difference between assisted living and a nursing home in Colorado?`,
      facilityVsNursingA: `An assisted living residence is licensed by CDPHE. Citations use Level A through E, and Level E is immediate jeopardy. A nursing home is certified by CMS. Its citations are F-tags with letters A through L. A letter E on a nursing home is not a Colorado Level E. StarlynnCare does not rank the two against each other.`,
      deficiencyLabel: "CDPHE Level C, D, or E citation, or a CMS deficiency at severity 3 or higher, depending on the care setting",
      indexedNoun: "memory care facilities",
      medicaidQ: (city) => `Does Health First Colorado cover memory care in ${city}?`,
      medicaidA: (city) =>
        `Health First Colorado can pay for some services in a certified Alternative Care Facility. It does not automatically pay room and board in every assisted living residence. A nursing home that takes Medicaid is a different benefit. Ask the home which program it accepts in ${city}.`,
    };
  }

  if (code === "MO") {
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `A regional benchmark for memory care across ${city} is ${formatCostRange("MO", "county")}. That is not a local median. DHSS does not publish facility rates.`
          : `A regional benchmark for memory care in ${city} is ${formatCostRange("MO", "city")}. That is not a ${city} median — Missouri DHSS does not publish facility rates, so ask each home for its current quote.`,
      licenseQ: `What makes a facility "memory care" in Missouri?`,
      licenseA: `Missouri does not issue a separate memory-care license. Homes here are licensed as Assisted Living Facilities (ALF) or Residential Care Facilities (RCF) by the Department of Health and Senior Services (DHSS) under 19 CSR 30. A facility that specializes in, advertises, or represents itself as providing Alzheimer's or dementia care must file an Alzheimer's Special Care Services Disclosure (RSMo §198.510). License level of care appears on each StarlynnCare profile when it is on the DHSS row.`,
      facilityVsNursingQ: `What's the difference between an ALF and a nursing home in Missouri?`,
      facilityVsNursingA: `Missouri ALFs and RCFs provide residential personal care under DHSS Section for Long-Term Care Regulation. Nursing facilities provide licensed nursing around the clock and are inspected under a different DHSS and CMS framework. If your family member needs IV medications, complex wound care, or continuous medical monitoring, a nursing facility may be more appropriate than an ALF or RCF.`,
      deficiencyLabel: "DHSS citation (Class I, II, or III under 19 CSR 30)",
      indexedNoun: "DHSS-licensed assisted living and residential care homes",
      medicaidQ: (city) => `Does MO HealthNet pay for memory care in ${city}?`,
      medicaidA: (city) =>
        `MO HealthNet (Missouri Medicaid) can cover some services in a participating assisted living or residential care facility, but room and board are typically the family's responsibility and not every ${city} home holds a contract. Eligibility is through the Department of Social Services. Ask each home which programs it accepts, and contact your local Area Agency on Aging.`,
    };
  }

  if (code === "AZ") {
    const azLicenseUrl = canonicalFor("/arizona/memory-care-licensing");
    return {
      costRange: (city, isCounty) =>
        isCounty
          ? `Listed prices for Directed Care homes across ${city} typically run ${formatCostRange("AZ", "county")} a month where a price is published. That is a listed price, not a quote.`
          : `Listed prices for Directed Care homes in ${city} typically run ${formatCostRange("AZ", "city")} a month where a price is published. Ask each home for its current rate.`,
      licenseQ: `What is Directed Care in Arizona?`,
      licenseA: `Arizona licenses assisted living as homes (ALH, up to 10 residents) or centers (ALC, 11 or more) at one of three care levels. Licensed for Directed Care means Arizona authorizes the home to provide memory care services under <strong>A.A.C. R9-10-816</strong> — policies, wandering safeguards, a medical-practitioner evaluation, and eight hours of staff training. HB2764 (Laws 2024, Ch. 100) told ADHS to write those standards for Directed Care homes; it did not create a separate Memory Care subclass. Authorization is not a claim that a given home runs a dedicated secured unit. See <a href="${azLicenseUrl}" class="text-teal underline underline-offset-4">Arizona memory care licensing</a>.`,
      facilityVsNursingQ: `What's the difference between Directed Care and a nursing home in Arizona?`,
      facilityVsNursingA: `Directed Care ALHs and ALCs provide residential personal care and supervision for people who need help with daily decisions, including many with dementia. Nursing homes are CMS-certified and provide 24-hour licensed nursing. If your family member needs IV medications, complex wound care, or continuous medical monitoring, a nursing facility may be more appropriate.`,
      deficiencyLabel: "A.A.C. R9-10 deficiency finding",
      indexedNoun: "Directed Care homes",
      medicaidQ: (city) => `Does ALTCS cover Directed Care in ${city}?`,
      medicaidA: (city) =>
        `Arizona Long Term Care System (ALTCS) can fund residential care in a Directed Care ALH or ALC for eligible residents through contracted managed care organizations. Not every ${city} home accepts ALTCS. Ask the home about contract status, and contact AHCCCS for eligibility.`,
    };
  }

  // California (default)
  const costGuideUrl = canonicalFor("/california/cost-guide");
  const alwUrl = "https://www.dhcs.ca.gov/individuals/Pages/ALW.aspx";
  return {
    costRange: (city, isCounty) =>
      isCounty
        ? `Memory care across ${city} runs from roughly $4,500/month at smaller RCFEs in lower-cost cities to $12,000+/month at premium memory-specific buildings. Median sits around $6,500–$8,000/month for a private room with standard care needs. Full bills almost always exceed the advertised base rate; most California facilities use "level of care" point systems adding $500–$2,500/month. Click into any city below for a tighter range, or read <a href="${costGuideUrl}" class="text-teal underline underline-offset-4">What memory care costs in California</a>.`
        : `Memory care in ${city} typically runs $5,000–$9,000/month, depending on level of care, room type, and licensing tier. The full bill almost always exceeds the advertised base rate. Most California facilities use "level of care" point systems adding $500–$2,500/month for residents needing more support with bathing, medication, or mobility. For statewide ranges and financing context, see <a href="${costGuideUrl}" class="text-teal underline underline-offset-4">What memory care costs in California</a>.`,
    licenseQ: `What makes a facility "memory care" in California?`,
    licenseA: `California has no separate memory care license. The facilities here are CDSS-licensed Residential Care Facilities for the Elderly (RCFEs) under Section 1569 of the Health & Safety Code. To advertise as memory care, an RCFE files a Memory Care Disclosure with CDSS and meets additional requirements around staff training, secured perimeters, and dementia programming. Some facilities here are skilled nursing facilities (SNFs) with a dementia or secure unit — a different license entirely (Title 22, Division 5). License type appears on every StarlynnCare profile.`,
    facilityVsNursingQ: `What's the difference between an RCFE and a nursing home?`,
    facilityVsNursingA: `RCFEs provide non-medical care: room, board, supervision, ADL help, medication assistance. Nursing homes (SNFs) provide medical care: licensed nurses on staff 24/7, medication administration (not just assistance), wound care, rehab. Most California memory care indexed here lives in RCFEs. If your family member needs ongoing skilled nursing — feeding tubes, IV medications, complex wound care — an RCFE memory unit may not fit.`,
    deficiencyLabel: "Type-A or Type-B deficiency from CDSS",
    indexedNoun: "licensed memory care facilities",
    medicaidQ: (city) => `Does Medi-Cal cover memory care in ${city}?`,
    medicaidA: (city) =>
      `Traditional Medi-Cal does not cover room and board in an RCFE memory care setting. The Assisted Living Waiver (ALW) can cover services in participating RCFEs for income-qualified residents, but waitlists are long and the program runs in a limited set of counties — whether ${city} is in an ALW service area depends on county (see <a href="${alwUrl}" class="text-teal underline underline-offset-4">CDSS ALW portal</a>). Medi-Cal does cover skilled nursing care in a Medi-Cal-certified SNF, including SNF dementia units, for residents meeting medical eligibility. Each facility profile documents payment acceptance when known.`,
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
      q:
        stateCode === "OR"
          ? `How many ${cityName} facilities have a citation on file?`
          : stateCode === "MN"
            ? `How many ${cityName} homes have an MDH finding on file?`
            : stateCode === "MO"
              ? `How many ${cityName} facilities have a DHSS citation on file?`
              : `How many ${cityName} facilities have a serious deficiency on file?`,
      a:
        totalCount === 0
          ? `StarlynnCare has not yet indexed publishable facilities for ${cityName}.`
          : `Of the ${totalCount} ${s.indexedNoun} listed in ${cityName}, ${facilitiesWithDeficiency} (${severePct}%) carry a documented ${s.deficiencyLabel} in the indexed inspection record. Specific findings appear on each profile with inspection date and source link. StarlynnCare sources all deficiency data directly from state regulator records — no facility-side surveys or paid submissions are used. See the <a href="${canonicalFor("/methodology")}" class="text-teal underline underline-offset-4">methodology</a> for how deficiency classes are mapped across states.`,
    },
    {
      q: `How does StarlynnCare compare memory care facilities in ${cityName}?`,
      a:
        stateCode === "CO"
          ? `Assisted living residences are compared with other Colorado assisted living residences. A nursing home is compared only with other Colorado nursing homes, and only when at least 10 homes share that care setting. Level A–E is the CDPHE scale. CMS letters A–L are the nursing-home scale. A home with too few peers shows its inspection record and no rank. Methodology: <a href="${canonicalFor("/methodology")}" class="text-teal underline underline-offset-4">starlynncare.com/methodology</a>.`
          : stateCode === "CA"
            ? `StarlynnCare does not assign a single letter grade. Instead, each profile shows four independent signals derived from CDSS inspection records: Type-A vs. Type-B deficiency class, repeat citation rate, inspection frequency relative to peers, and trajectory over time. Facilities with too few inspections in the records we hold show a "limited history" notice rather than a misleading score. Full methodology is at <a href="${canonicalFor("/methodology")}" class="text-teal underline underline-offset-4">starlynncare.com/methodology</a>.`
            : `StarlynnCare does not assign a single letter grade. Each profile shows the state's own inspection record — ${s.deficiencyLabel} — with dates and source links. Facilities with too few inspections in the records we hold show a "limited history" notice rather than a misleading score. Full methodology is at <a href="${canonicalFor("/methodology")}" class="text-teal underline underline-offset-4">starlynncare.com/methodology</a>.`,
    },
    {
      q: `What should I look for on a memory care tour in ${cityName}?`,
      a: `What predicts safety usually isn't what admissions directors highlight. From clinician and family interviews, the most under-asked items: staff-to-resident ratio at night and on weekends, skin-check and wound-prevention protocol, medication management and error reporting, shower frequency, and how the facility handles behavioral escalation. We publish a free <a href="${resolvedTourUrl}" class="text-teal underline underline-offset-4">37-question tour checklist</a> you can print.`,
    },
    {
      q: `Where can I find inspection reports for memory care facilities in ${cityName}?`,
      a:
        stateCode === "CO"
          ? `Assisted living profiles link to CDPHE Find and Compare Facilities. The citation text in this release comes from a CDPHE records file dated May 18, 2026. Nursing-home profiles link to Medicare Care Compare. Each profile's inspection record names which regulator wrote the finding.`
          : `Every facility profile on StarlynnCare links to its state inspection records — the same documents regulators use to evaluate compliance. ${
              stateCode === "CA"
                ? "California reports come from the CDSS Community Care Licensing portal."
                : stateCode === "TX"
                  ? "Texas reports come from HHSC Long-Term Care Regulation."
                  : stateCode === "OR"
                    ? "Oregon reports come from DHS Long-Term Care Licensing (ltclicensing.oregon.gov)."
                    : stateCode === "MN"
                      ? "Minnesota reports come from the Minnesota Department of Health under ch. 144G."
                      : stateCode === "MO"
                        ? "Missouri reports come from DHSS Section for Long-Term Care Regulation under 19 CSR 30."
                        : "Each profile names the regulator that wrote the finding."
            } On each facility profile, open the inspection record for verbatim citations with dates. You can also access the <a href="${canonicalFor("/api/facilities/" + region.state.slug)}" class="text-teal underline underline-offset-4">underlying raw data</a> (open dataset).`,
    },
    {
      q: isCounty
        ? `What are the ratings for memory care facilities in ${cityName}?`
        : `How are memory care facilities in ${cityName} rated?`,
      a:
        stateCode === "CO"
          ? `Profiles use the public inspection record, not a star rating and not a payment from the home. Assisted living severity is CDPHE Level A through E. Nursing-home severity is the CMS letter on the F-tag. You can sort ${cityName} facilities with the "By record" toggle. No referral commission changes the order.`
          : stateCode === "CA"
            ? `StarlynnCare uses CDSS inspection data — not self-reported surveys or paid placements. Each profile surfaces Type-A vs. Type-B class, citation frequency relative to peers, repeat-finding rate, and inspection recency. Facilities with too few inspections receive a "limited history" label. You can sort ${cityName} facilities with the "By record" toggle. No referral commissions change the order.`
            : `StarlynnCare uses state inspection data — not self-reported surveys or paid placements. Each profile shows ${s.deficiencyLabel} with dates, not a star rating. Facilities with too few inspections receive a "limited history" label rather than a misleading composite score. You can sort ${cityName} facilities with the "By record" toggle. No referral commissions change the order.`,
    },
    {
      q: s.medicaidQ(cityName),
      a: s.medicaidA(cityName),
    },
  ];
}
