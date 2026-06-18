export interface FaqItem {
  q: string;
  a: string;
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
    a: "California, Oregon, Washington, Minnesota, and Texas are all live with publishable facility profiles. Each state's data comes from its respective state regulator — CDSS for California, Oregon DHS for Oregon, DSHS for Washington, MDH for Minnesota, and HHSC for Texas.",
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
    q: "Do you accept payments from facilities or operators?",
    a: "No. StarlynnCare receives no referral commissions, lead fees, or paid placement from any operator. Rankings are derived solely from state inspection records and verified family reviews.",
  },
  {
    q: "How often is Washington data updated?",
    a: "After each ingest run from the DSHS ALF Reports portal. Source links appear on each facility profile.",
  },
  {
    q: "What is Washington's Specialized Dementia Care contract?",
    a: "The Specialized Dementia Care contract is a DSHS contract tier that ALFs holding this status must meet — it requires staff with specific dementia care training, behavioral support protocols, and enhanced supervision standards beyond a standard ALF license. Only Specialized Dementia Care contracted ALFs appear on StarlynnCare for Washington.",
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
    a: "Arizona uses three license levels for assisted living facilities: Supervisory Care (least intensive), Personal Care, and Directed Care (most intensive). A Directed Care license authorizes the facility to serve residents who need continuous supervision, protective oversight, or assistance due to cognitive impairment — including dementia and Alzheimer's disease. StarlynnCare only indexes facilities with an active Directed Care license or the new HB2764 Memory Care subclass, because these are the state-verified signals that the facility is equipped for dementia care.",
  },
  {
    q: "What is the new Arizona Memory Care subclass (HB2764)?",
    a: "Arizona House Bill 2764, signed into law and effective July 1, 2025, created a formal Memory Care subclass for Assisted Living Homes and Centers. Facilities obtaining this subclass must meet enhanced staffing, training, physical environment, and programming requirements specifically designed for residents with Alzheimer's disease or other dementias. StarlynnCare will incorporate this subclass as the primary Tier-1 signal once ADHS begins publishing it in the facility directory.",
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
