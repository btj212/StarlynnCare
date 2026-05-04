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
    a: "California is fully indexed. Texas and Florida are in active rollout. We are prioritizing states with public, structured inspection data.",
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

/** Same as `CA_FAQS` — kept for `homeFaqs` re-exports and legacy `HOME_FAQS` imports. */
export const HOME_FAQS = CA_FAQS;
