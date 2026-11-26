import type { Coverage } from "@/lib/coverage";
import { coverageFaqAnswer } from "@/lib/coverage";

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * National homepage FAQ. State-specific lists stay below; this one
 * is the only FAQ set the homepage is allowed to render, so coverage
 * cannot drift from the stats grid.
 */
export function buildNationalFaqs(coverage: Coverage): FaqItem[] {
  return [
    {
      q: "Where does the data come from?",
      a: "Primary sources only: the state license office in each covered state, CMS Care Compare where a home has a federal identifier, and verified family reviews submitted through our identity-checked review form. Every profile links to the regulator record we used.",
    },
    {
      q: "Do you accept payments from facilities or operators?",
      a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews.",
    },
    {
      q: "How often is the data updated?",
      a: "Inspection records are pulled from each state's public portal on a regular automated schedule. Each facility profile shows when that home's record was last refreshed. National counts on the homepage revalidate hourly.",
    },
    {
      q: "Which states do you cover?",
      a: coverageFaqAnswer(coverage),
    },
    {
      q: "Can a facility correct or respond to information on its profile?",
      a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove citations at operator request, but we publish operator context and corrective actions alongside the original record.",
    },
  ];
}

/** California memory-care hub & homepage FAQ set (CDSS framing). */
export const CA_FAQS: FaqItem[] = [
  {
    q: "Where does the data come from?",
    a: "Primary sources only: California Department of Social Services Community Care Licensing (CDSS), CMS Care Compare, county ombudsman complaint outcomes, and verified family reviews submitted through our identity-checked review form.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews. We are funded by reader memberships and the sale of our annual data report to public-interest organizations.",
  },
  {
    q: "How often is the data updated?",
    a: "Inspection records are pulled from CDSS weekly. New family reviews are verified and posted within 5 business days. Each facility profile shows the exact 'last updated' timestamp at the top of the page.",
  },
  {
    q: "Which states do you cover?",
    a: "StarlynnCare publishes memory care homes in California, Oregon, Washington, Minnesota, Utah, Illinois, Pennsylvania, Arizona, Missouri, Texas, and Colorado. Texas and Colorado are pilots until their published sets grow. Each state's data comes from its regulator — CDSS, Oregon DHS, DSHS, MDH, HHSC, DLBC, IDPH, PA DHS, ADHS, DHSS, and CDPHE.",
  },
  {
    q: "Where do I look up a California RCFE license?",
    a: "On the CDSS Community Care Licensing facility search at ccld.dss.ca.gov/carefacilitysearch. Search by name or license number. The lookup section on this page links to that portal and to a step-by-step how-to for the memory care homes we publish.",
  },
  {
    q: "Can a facility correct or respond to information on its profile?",
    a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove citations at operator request, but we publish operator context and corrective actions alongside the original record.",
  },
];

/** Texas HHSC LTCR framing — use on `/texas` rich hub when it ships. */
export const TX_FAQS: FaqItem[] = [
  {
    q: "Where does Texas inspection data come from?",
    a: "Primary sources: Texas Health & Human Services Commission (HHSC) Long-Term Care Regulation (LTCR) public records, the HHSC assisted living directory where applicable, and verified family reviews submitted through our identity-checked review form. Narrative inspection findings are reproduced verbatim from regulator-facing records.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews. We are funded by reader memberships and the sale of our annual data report to public-interest organizations.",
  },
  {
    q: "How often is Texas data updated?",
    a: "After each ingest run from HHSC-sourced records. When bulk data is delivered via Public Information Act fulfillment, we refresh the full Alzheimer-certified subset in one pass. Each facility profile shows source URLs and visit dates.",
  },
  {
    q: "What does Texas Type A / B / C mean vs California Type A / B deficiencies?",
    a: "Texas license classes (Type A, B, C) describe facility capability under HHSC rules — not citation severity. California 'Type A' and 'Type B' deficiency labels are entirely different: they describe inspection citation severity in RCFE records. Do not conflate the two systems.",
  },
  {
    q: "Can a facility correct or respond to information on its profile?",
    a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove citations at operator request, but we publish operator context and corrective actions alongside the original record.",
  },
];

/** Oregon DHS LTC Licensing framing. */
export const OR_FAQS: FaqItem[] = [
  {
    q: "Where does Oregon inspection data come from?",
    a: "Primary sources: Oregon Department of Human Services (DHS), Long-Term Care Licensing public portal — including licensing violations and abuse investigation records for ALFs and RCFs holding the Memory Care Endorsement. Inspection findings are sourced directly from ltclicensing.oregon.gov.",
  },
  {
    q: "Where do I look up an Oregon assisted living license?",
    a: "On the Oregon DHS Long-Term Care Licensing portal at ltclicensing.oregon.gov. Search the home by name or license number. The lookup section on this page links to that portal and to a step-by-step how-to for the memory care homes we publish.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews.",
  },
  {
    q: "How often is Oregon data updated?",
    a: "After each ingest run from the Oregon DHS LTC Licensing portal. Source links and download dates appear on each facility profile.",
  },
  {
    q: "What is Oregon's Memory Care Endorsement?",
    a: "The Memory Care Endorsement is a separate certification issued by Oregon DHS on top of an ALF or RCF license. To hold the endorsement, a facility must meet enhanced requirements for dementia staff training, individualized care planning, and secured-environment protocols. Only endorsed facilities appear on StarlynnCare for Oregon.",
  },
  {
    q: "Can a facility correct or respond to information on its profile?",
    a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove violations at operator request.",
  },
];

/** Washington DSHS ADSA framing. */
export const WA_FAQS: FaqItem[] = [
  {
    q: "Where does Washington inspection data come from?",
    a: "Primary sources: Washington State Department of Social and Health Services (DSHS), Aging and Disability Services Administration (ADSA), Residential Care Services — specifically the public ALF Reports portal (fortress.wa.gov). Inspection and investigation report links are sourced directly from that portal.",
  },
  {
    q: "Where do I look up a Washington assisted living inspection report?",
    a: "On the DSHS ALF public lookup at fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx. Search the home by name or license number. The lookup section on this page links to that portal and to a step-by-step how-to for the memory care homes we publish.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews.",
  },
  {
    q: "How often is Washington data updated?",
    a: "After each ingest run from the DSHS ALF Reports portal. Source links appear on each facility profile.",
  },
  {
    q: "What is Washington's Specialized Dementia Care contract?",
    a: "The Specialized Dementia Care contract is a DSHS contract tier that ALFs holding this status must meet — it requires staff with specific dementia care training, behavioral support protocols, and enhanced supervision standards beyond a standard ALF license. It is not the default license. StarlynnCare lists Washington assisted living facilities and adult family homes that serve people with dementia; only homes with an SDC contract (or a Memory Care Certified designation when DSHS publishes it) are labeled memory care.",
  },
  {
    q: "Can a facility correct or respond to information on its profile?",
    a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove inspection findings at operator request.",
  },
];

/** Minnesota MDH framing. */
export const MN_FAQS: FaqItem[] = [
  {
    q: "Where does Minnesota inspection data come from?",
    a: "Primary sources: Minnesota Department of Health (MDH), which regulates Assisted Living Facilities under Minn. Stat. ch. 144G. Complaint and survey findings are published publicly by MDH. StarlynnCare indexes MDH licensing records and inspection outcomes.",
  },
  {
    q: "Where is the Minnesota assisted living report card?",
    a: "The Minnesota Department of Health publishes assisted living licensing and inspection records in its provider directory at health.state.mn.us/facilities/providers. That directory is the official lookup. The lookup section on this page links to MDH and to a step-by-step how-to for the memory care homes we publish.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews.",
  },
  {
    q: "How often is Minnesota data updated?",
    a: "After each ingest run from MDH licensing records. Source dates appear on each facility profile.",
  },
  {
    q: "What is Minnesota's Assisted Living Facility with Dementia Care license?",
    a: "Minnesota's 2019 Assisted Living Licensure Reform (Minn. Stat. ch. 144G) created a distinct license tier for facilities serving residents with Alzheimer's and dementia. Requirements include dementia-trained staff at all times, individualized dementia programming, and secured environments where clinically indicated — requirements beyond a standard ALF license.",
  },
  {
    q: "Can a facility correct or respond to information on its profile?",
    a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove MDH findings at operator request.",
  },
];

/** Utah DLBC framing. */
export const UT_FAQS: FaqItem[] = [
  {
    q: "Where does Utah memory care inspection data come from?",
    a: "Primary sources: the Utah Dept. of Health & Human Services Division of Licensing and Background Checks (DLBC), which regulates Assisted Living Facilities (Type I and Type II) under Utah Admin. Code R432-270. Inspection findings and complaint outcomes are published publicly via the Utah CCL portal at ccl.utah.gov. StarlynnCare also overlays CMS inspection data for nursing facilities.",
  },
  {
    q: "What is the difference between a Type I and Type II Assisted Living Facility in Utah?",
    a: "Type I ALFs provide services to residents who need assistance with activities of daily living but who are ambulatory or able to self-transfer. Type II ALFs serve residents who are non-ambulatory or who require physical assistance with transfers and may need a higher level of personal care — including many residents with moderate-to-advanced dementia.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews.",
  },
  {
    q: "How often is Utah data updated?",
    a: "After each ingest run from DLBC licensing records and the Utah CCL public API. Source dates appear on each facility profile.",
  },
  {
    q: "Can a facility correct or respond to information on its profile?",
    a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove DLBC findings at operator request.",
  },
];

/** Illinois IDPH Division of Assisted Living framing. */
export const IL_FAQS: FaqItem[] = [
  {
    q: "Where does Illinois inspection data come from?",
    a: "Primary source: the Illinois Department of Public Health (IDPH) Division of Assisted Living, which regulates Assisted Living Establishments (ALEs) and Shared Housing Establishments (SHEs) under 77 Ill. Adm. Code Part 295. Inspection and complaint records were obtained through a Freedom of Information Act (FOIA) request and are supplemented by per-event complaint reports from the IDPH LLCS portal at llcs.dph.illinois.gov.",
  },
  {
    q: "What do Type 1, Type 2, and Type 3 violations mean in Illinois?",
    a: "Illinois classifies ALE/SHE violations by severity under Part 295. Type 1 is the most serious — involving immediate jeopardy, death, or actual harm — and typically carries the highest fines. Type 2 covers situations with potential for harm or repeated non-compliance. Type 3 is the least severe, covering administrative or technical deficiencies. Illinois does not use federal F-tags or the California-style Type A/B classification.",
  },
  {
    q: "Does StarlynnCare cover all Illinois assisted living facilities?",
    a: "No. StarlynnCare indexes only facilities with a confirmed memory care or dementia care focus — either because their name includes 'memory care', 'dementia', or 'Alzheimer', or because the IDPH portal identifies them as operating a dementia special-care unit. Non-memory-care ALEs are excluded.",
  },
  {
    q: "Where is the IDPH nursing home lookup — and does StarlynnCare include nursing homes?",
    a: "The Illinois Department of Public Health facility lookup is at llcs.dph.illinois.gov. StarlynnCare holds Illinois assisted living establishments only, not nursing homes. To check a nursing home, use the IDPH lookup. The lookup section on this page links to IDPH and to a how-to for the assisted living homes we publish.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Data is derived solely from state inspection records and verified family reviews.",
  },
  {
    q: "How often is Illinois data updated?",
    a: "The founding dataset covers January 2024 through May 2026 and was received via FOIA request. Per-event complaint PDFs are fetched from the IDPH LLCS portal as they become available. Each facility profile shows the exact inspection exit date and source link.",
  },
];

/** Pennsylvania DHS OLTL framing — PCH/ALR, Special Care, and Secure Dementia Care Unit. */
export const PA_FAQS: FaqItem[] = [
  {
    q: "Where does Pennsylvania memory care inspection data come from?",
    a: "Primary source: the Pennsylvania Department of Human Services (DHS) Office of Long-Term Living (OLTL), which regulates Personal Care Homes (PCH) under 55 Pa Code Chapter 2600 and Assisted Living Residences (ALR) under 55 Pa Code Chapter 2800. DHS publishes inspection findings in PDF format on its provider directory portal. StarlynnCare downloads, parses, and indexes those PDFs for each facility profile.",
  },
  {
    q: "Where do I find Pennsylvania personal care home inspection reports?",
    a: "In the Department of Human Services provider directory (humanservices.dhs.pa.gov). Choose the Office of Long-Term Living as the program office and type at least four characters of the home's name. The lookup section on this page links to that directory and to a step-by-step how-to for the memory care homes we publish.",
  },
  {
    q: "What is the difference between a Personal Care Home and an Assisted Living Residence in Pennsylvania?",
    a: "Both are licensed by PA DHS OLTL and can serve residents with dementia, but they differ in scope. A Personal Care Home (PCH, Chapter 2600) provides room, board, and personal care services to adults who need assistance with activities of daily living. An Assisted Living Residence (ALR, Chapter 2800) offers a higher level of care, including nursing oversight, medication management, and more intensive personal care — appropriate for residents with greater care needs. Memory care programming can operate within either license type.",
  },
  {
    q: "What do 'Special Care' and 'Secure Dementia Care Unit' mean on a Pennsylvania profile?",
    a: "These are designations recorded in the DHS HSD provider directory under the 'Special Care/Secure Dementia Care Unit' column. A 'Special Care' designation indicates the facility operates a dedicated dementia-specific care unit. A 'Secure Dementia Care Unit' indicates a secured environment specifically designed to prevent unsafe exits for residents with advanced dementia. Both are DHS-recognized — not self-reported — designations. StarlynnCare lists only facilities with one of these designations, or facilities with an active Assisted Living — Special Care license type.",
  },
  {
    q: "How does PA DHS inspect memory care facilities?",
    a: "DHS OLTL conducts routine annual surveys and complaint investigations of licensed PCHs and ALRs. Inspectors cite violations under the applicable 55 Pa Code chapter — each citation references the specific regulation section. Enforcement actions range from standard citations (correctable findings) to civil money penalties, provisional license status, and in serious cases, license revocation. StarlynnCare shows each PA DHS citation on the facility profile with its severity level and plain-language description.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from DHS inspection records and verified family reviews.",
  },
  {
    q: "Can a facility correct or respond to information on its profile?",
    a: "Yes. Every profile includes a verified-operator response field, edited by us only for length. We do not remove DHS findings at operator request.",
  },
];

/** Arizona ADHS BRFL framing — Directed Care, ALH/ALC, and A.A.C. Title 9. */
export const AZ_FAQS: FaqItem[] = [
  {
    q: "Where does Arizona memory care inspection data come from?",
    a: "StarlynnCare sources Arizona facility data from the ADHS Bureau of Residential Facilities Licensing (BRFL), which regulates Assisted Living Homes (ALH, up to 10 residents) and Assisted Living Centers (ALC, 11+ residents) under A.A.C. Title 9, Chapter 10. Inspection records are published on the AZ Care Check consumer portal (azcarecheck.azdhs.gov). StarlynnCare downloads and indexes the underlying inspection reports for each facility profile.",
  },
  {
    q: "What is 'Directed Care' and why does it matter for memory care?",
    a: "Arizona uses three license levels for assisted living facilities: Supervisory Care (least intensive), Personal Care, and Directed Care (most intensive). Licensed for Directed Care means Arizona authorizes the home to provide memory care services under A.A.C. R9-10-816 (effective June 30, 2025): policies, wandering safeguards, a medical-practitioner evaluation, and eight hours of staff training. StarlynnCare indexes Directed Care homes for that reason. Authorization is not a claim that a given home runs a dedicated secured memory-care unit.",
  },
  {
    q: "Did HB2764 create a separate Memory Care license subclass?",
    a: "No. House Bill 2764 (Laws 2024, Chapter 100) added A.R.S. § 36-405.03, which told ADHS to write memory-care service standards and staff-training rules for assisted living facilities that are already licensed to provide directed care. ADHS did that in A.A.C. R9-10-816. In the final-rulemaking hearing, ADHS said memory care services are the same as directed care. There is no separate Memory Care subclass to apply for.",
  },
  {
    q: "How does ADHS inspect assisted living facilities?",
    a: "ADHS BRFL conducts routine inspections (typically annual) and complaint investigations of licensed ALHs and ALCs. Inspectors cite violations by A.A.C. rule section (e.g. R9-10-814). Enforcement actions range from standard citations with a required plan of correction to civil money penalties, suspension, and license revocation for serious violations. AZ Care Check publishes inspection reports, but structured data requires downloading and parsing the underlying PDFs.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Data is derived solely from ADHS inspection records and verified family reviews.",
  },
  {
    q: "How often is Arizona data updated?",
    a: "The ADHS ArcGIS directory is refreshed monthly. StarlynnCare re-ingests the directory on a 36-month freshness cycle. Inspection records are collected directly from the AZ Care Check platform via the underlying data API — structured inspection data including dates, inspector narratives, and deficiency counts. Each profile shows the inspection exit date and a direct link to the AZ Care Check source page for independent verification.",
  },
];

/** Same as `CA_FAQS` — kept for `homeFaqs` re-exports and legacy `HOME_FAQS` imports. */
export const HOME_FAQS = CA_FAQS;

/** Colorado CDPHE assisted living and CMS nursing homes. No invented prices. */
export const CO_FAQS: FaqItem[] = [
  {
    q: "Where does Colorado memory care data come from?",
    a: "Assisted living residences come from the Colorado Department of Public Health and Environment health-facilities directory. Complaint and citation rows in this first release come from a CDPHE records file dated May 18, 2026. Nursing homes come from CMS Care Compare. The two records are kept separate.",
  },
  {
    q: "Does Colorado have a memory-care license?",
    a: "No. CDPHE licenses assisted living residences under 6 CCR 1011-1 Chapter 7. A secure environment is optional, and CDPHE does not publish a facility-level list of homes that have one. Dementia training is required for every assisted living residence, so training is not a memory-care designation.",
  },
  {
    q: "Why are some nursing homes not listed?",
    a: "A nursing home is listed only when a memory-care signal is strong enough to publish: the name, a verified memory-care chain, or two independent directories. A home we are still checking stays off the public list. Uncertain is a review status, not a claim that the home offers memory care.",
  },
  {
    q: "Are Colorado Level A through E the same as CMS letters?",
    a: "No. Level A through E are CDPHE assisted-living citations. Level E is immediate jeopardy. CMS nursing-home letters A through L are a different scale. A letter E on a nursing home is not a Colorado Level E.",
  },
  {
    q: "Do you accept payments from facilities?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator.",
  },
];

/** Missouri DHSS LTCR framing. */
export const MO_FAQS: FaqItem[] = [
  {
    q: "Where does Missouri memory care data come from?",
    a: "Primary sources: Missouri Department of Health and Senior Services (DHSS), Section for Long-Term Care Regulation. Facility licensing data comes from the DHSS LTC Directory (data.mo.gov Socrata dataset). Inspection and deficiency records were obtained via a FOIA public records request and cover 2018–2026 across all Assisted Living Facility (ALF) and Residential Care Facility (RCF) license types.",
  },
  {
    q: "What is the memory care signal in Missouri?",
    a: "Missouri has no standalone memory care license. StarlynnCare publishes facilities that meet either of two authoritative signals: (1) the facility has filed the Alzheimer's Special Care Services Disclosure (Form MO 580-2637, required by §198.510 RSMo) — the state's official dementia-care disclosure; or (2) the facility holds an ALF** license, which authorizes retention of residents who cannot self-evacuate (§198.073.6 RSMo), indicating a secure-environment capability. Name-keyword matching alone is not used.",
  },
  {
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from DHSS inspection records and verified family reviews.",
  },
  {
    q: "How often is Missouri data updated?",
    a: "The DHSS LTC Directory is refreshed when DHSS publishes updates to the public dataset. Inspection records were obtained via FOIA and cover 2018–2026 as of the initial ingest. Each profile shows source dates for independent verification.",
  },
  {
    q: "What is an ALF** license in Missouri?",
    a: "ALF** ('ALF double-star') designates an Assisted Living Facility licensed under §198.073.6 RSMo to retain residents who cannot self-evacuate in an emergency — a common profile for residents with moderate to advanced dementia. This is one of the two Tier-1 memory-care signals used by StarlynnCare for Missouri. The standard ALF license does not carry this authorization.",
  },
];
