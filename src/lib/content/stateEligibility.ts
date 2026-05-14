/**
 * State-specific Medicaid/waiver eligibility content for memory care hub pages.
 *
 * Used by HubEligibility component on city and county hub pages.
 *
 * Content reflects publicly available program rules as of 2025. Families must
 * contact their county/state agency to confirm current eligibility requirements
 * and enrollment status — waiver slots are limited and wait lists are common.
 * Per CLAUDE.md YMYL rule: all claims must cite the state agency or program page.
 */

export interface StateEligibilityEntry {
  /** Program or waiver name (e.g. "Medi-Cal Assisted Living Waiver"). */
  programName: string;
  /** One-line description of what the program covers. */
  programSummary: string;
  /** 2–3 paragraphs of eligibility context. HTML is NOT allowed — plain text only. */
  paragraphs: string[];
  /** Short VA/private-pay note. */
  privatePayNote: string;
  /** Source URL for citation. */
  sourceUrl: string;
  /** Short label for the DataFootnote source field. */
  sourceLabel: string;
}

const ELIGIBILITY: Record<string, StateEligibilityEntry> = {
  CA: {
    programName: "Medi-Cal Assisted Living Waiver (ALW)",
    programSummary:
      "California's Assisted Living Waiver covers room, board, and personal-care services at enrolled memory care facilities for eligible Medi-Cal beneficiaries.",
    paragraphs: [
      "The Medi-Cal Assisted Living Waiver (ALW) is a Home and Community-Based Services (HCBS) waiver that pays for room, board, and supportive services at enrolled Residential Care Facilities for the Elderly (RCFEs). To qualify, a resident must meet nursing-facility level of care criteria, be enrolled in Medi-Cal (full-scope), and reside in an ALW-enrolled facility in a participating county. Because waiver slots are finite, a waiting list is common — families should apply early through their local Department of Social Services.",
      "Most memory care residents in California pay privately. Private-pay rates typically range from $5,000 to $9,000 per month depending on the facility and care intensity. Long-term care insurance and Veterans' benefits (VA Aid and Attendance) can offset costs for eligible individuals. Consult a certified senior benefits counselor (HICAP) for personalized guidance.",
      "Families researching public-pay options should confirm with each facility whether it accepts ALW patients and whether an ALW slot is currently available. StarlynnCare displays state inspection data only; we do not verify payment-program participation. Always verify directly with the facility and your county social services department.",
    ],
    privatePayNote:
      "Veterans may be eligible for VA Aid and Attendance, which can supplement private-pay memory care costs. Contact your regional VA or an accredited VA claims agent.",
    sourceUrl: "https://www.dhcs.ca.gov/individuals/Pages/ALW.aspx",
    sourceLabel: "CA DHCS Assisted Living Waiver",
  },
  OR: {
    programName: "Oregon K Plan (1915(k) Community First Choice)",
    programSummary:
      "Oregon's K Plan finances personal-care services for Medicaid-eligible residents at licensed memory care facilities, including Memory Care Endorsed ALFs and RCFs.",
    paragraphs: [
      "Oregon coordinates Medicaid long-term care services through the Oregon Department of Human Services (DHS) Office of Aging and People with Disabilities. Medicaid-eligible residents in licensed Assisted Living Facilities (ALFs) or Residential Care Facilities (RCFs) with a Memory Care Endorsement can receive personal-care services paid through the Medicaid K Plan (Community First Choice). Room and board costs are not covered by Medicaid — residents pay this portion from their own income or resources.",
      "Eligibility requires meeting functional and financial criteria established by Oregon DHS. Functional eligibility is assessed through the Oregon Comprehensive Assessment, and financial eligibility follows standard Medicaid income and asset rules. Many applicants use a spending-down strategy or irrevocable trust to qualify. Contact your local Aging and People with Disabilities office to start the assessment process.",
      "Private-pay families should budget $4,500–$8,500 per month for memory-care ALFs or RCFs in Oregon, depending on geography and care complexity. Oregon's Long-Term Care Ombudsman (LTCO) can help families navigate care quality concerns independent of finances.",
    ],
    privatePayNote:
      "Veterans may qualify for VA Aid and Attendance or Housebound benefits. Oregon also has a State Veterans Home in Portland for eligible veterans needing memory care.",
    sourceUrl:
      "https://www.oregon.gov/dhs/SENIORS-DISABILITIES/LTCOP/Pages/index.aspx",
    sourceLabel: "Oregon DHS Aging & People with Disabilities",
  },
  WA: {
    programName: "COPES Waiver (Community Options Program Entry System)",
    programSummary:
      "Washington's COPES waiver pays for personal-care and support services at licensed Specialized Dementia Care ALFs for Medicaid-eligible residents.",
    paragraphs: [
      "Washington State's COPES (Community Options Program Entry System) waiver is the primary Medicaid pathway for residents of licensed Assisted Living Facilities (ALFs) with a Specialized Dementia Care contract. COPES covers personal-care services, medication administration, and certain therapies. Room and board are not Medicaid-funded and are paid by residents from their own income or assets. DSHS (Department of Social Services and Health) manages eligibility assessments and waiver enrollment.",
      "To qualify for COPES, a person must meet nursing-facility level of care standards as determined by a DSHS assessment, and must be financially eligible for Medicaid (SSI-related rules apply). Wait lists exist in some counties. Families should initiate the DSHS assessment as early as possible — contact your local Area Agency on Aging (AAA) or DSHS Home and Community Services office.",
      "Private-pay memory care in Washington typically costs $5,500–$9,500 per month. Long-term care insurance, veteran benefits, and private annuities are common funding sources. Washington also offers a state-run Carer Support Program for family caregivers who are delaying facility placement.",
    ],
    privatePayNote:
      "The Washington State Department of Veterans Affairs (WDVA) operates a network of veterans homes and can assist eligible veterans with memory care placement and funding.",
    sourceUrl:
      "https://www.dshs.wa.gov/altsa/home-and-community-services/community-options-program-entry-system",
    sourceLabel: "WA DSHS Home and Community Services",
  },
  MN: {
    programName: "Minnesota Elderly Waiver (EW)",
    programSummary:
      "Minnesota's Elderly Waiver covers home and community-based services for seniors who would otherwise qualify for nursing home placement, including Medicaid-eligible residents of licensed memory care ALFs.",
    paragraphs: [
      "Minnesota's Elderly Waiver (EW) is the primary Medicaid program financing long-term services and supports for seniors in Assisted Living Facilities with Dementia Care (ALFD). EW covers a broad range of services — personal care, nursing oversight, day services, and assistive technology — but does not cover room and board. To qualify, residents must meet nursing-facility level of care criteria and be eligible for Medical Assistance (Minnesota Medicaid). Applications are processed through county human services agencies.",
      "Minnesota uses a managed care system for most EW enrollees; services are coordinated through a health plan or a Senior Health Options plan. Lead Agencies (typically county or tribal social services) conduct initial assessments and manage waiver enrollment. Because EW has a statewide budget cap, wait lists are possible — families should apply as early as care needs emerge.",
      "Private-pay memory care in Minnesota costs approximately $4,500–$8,500 per month. Minnesota also offers the Alternative Care (AC) program for individuals who do not yet meet nursing-facility criteria, providing a bridge for families planning ahead.",
    ],
    privatePayNote:
      "Minnesota has a Veterans Home system with memory care capacity at multiple locations. VA Aid and Attendance benefits can supplement private-pay costs at community facilities for eligible veterans.",
    sourceUrl:
      "https://mn.gov/dhs/people-we-serve/seniors/services/long-term-care-services/programs-and-services/elderly-waiver.jsp",
    sourceLabel: "MN DHS Elderly Waiver",
  },
  TX: {
    programName: "STAR+PLUS Waiver (Texas Medicaid)",
    programSummary:
      "Texas's STAR+PLUS managed care program is the primary Medicaid pathway for seniors needing personal-care services in licensed Alzheimer-certified Assisted Living Facilities.",
    paragraphs: [
      "Texas delivers Medicaid long-term services and supports through the STAR+PLUS managed care program, administered by the Texas Health and Human Services Commission (HHSC). For residents of Alzheimer-certified ALFs, STAR+PLUS covers personal-care attendant services, case management, and certain therapies. Room and board costs are not covered and must be paid by the resident. Enrollment is through a Medicaid managed care organization (MCO) with HHSC oversight.",
      "Eligibility for STAR+PLUS requires meeting both functional criteria (assessed through the Needs Assessment Questionnaire and Determination, NAQD) and financial Medicaid eligibility. Texas also administers a Community Living Assistance and Support Services (CLASS) waiver and a STAR+PLUS Home and Community Based Services (HCBS) waiver for individuals who need nursing-facility-level care but prefer a community setting. Contact your local HHSC Benefits Office or a certified application counselor (CAC) to determine which pathway fits your family's situation.",
      "Private-pay Alzheimer-certified ALF care in Texas typically costs $4,500–$7,500 per month. Texas has a large network of veterans homes managed by the Texas Veterans Land Board that may be available to eligible veterans.",
    ],
    privatePayNote:
      "The Texas Veterans Land Board operates veterans homes with memory care programs for eligible veterans. VA Aid and Attendance benefits can supplement private-pay costs at certified facilities.",
    sourceUrl:
      "https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living-facilities",
    sourceLabel: "Texas HHSC Assisted Living Facilities",
  },
};

export function getStateEligibility(
  stateCode: string,
): StateEligibilityEntry | null {
  return ELIGIBILITY[stateCode.toUpperCase()] ?? null;
}
