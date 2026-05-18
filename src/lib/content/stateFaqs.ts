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

/** Same as `CA_FAQS` — kept for `homeFaqs` re-exports and legacy `HOME_FAQS` imports. */
export const HOME_FAQS = CA_FAQS;
