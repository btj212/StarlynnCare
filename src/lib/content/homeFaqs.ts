export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Homepage FAQ items. Used to render the FAQ accordion and build FAQPage JSON-LD.
 * Keep in sync with the buildFaqPageSchema call in src/app/page.tsx.
 */
export const HOME_FAQS: FaqItem[] = [
  {
    q: "How is each facility's grade calculated?",
    a: "We weight five inputs: severity of state inspection findings, repeat-citation frequency, complaint outcomes, staffing-related deficiencies, and verified family-experience reviews. Every grade links to the underlying CDSS records and the date each input was last refreshed. Read the full methodology for the formula and weights.",
  },
  {
    q: "Where does the data come from?",
    a: "Primary sources only: California Department of Social Services Community Care Licensing (CDSS), CMS Care Compare, county ombudsman complaint outcomes, and verified family reviews submitted through our identity-checked review form. Operator-supplied marketing copy is not factored into the grade.",
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
