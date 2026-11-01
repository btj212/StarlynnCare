/** Canonical independence line. Keep site chrome, schema, and llms.txt on this string. */
export const GOVERNANCE_24_WORDS =
  "No commissions and no paid rankings. Grades come only from state records. Eligible communities can pay to add labeled information to their own page.";

/** Phrase the governance bar emphasizes. Must appear inside GOVERNANCE_24_WORDS. */
export const GOVERNANCE_EMPHASIS = "No commissions and no paid rankings.";

/** Shared answer for "do you accept payments from facilities?" FAQs. */
export function operatorPaymentFaqAnswer(rankingSentence: string): string {
  return `Communities that clear a published bar can pay a flat monthly fee to add labeled photos, prices, and a tour button to their own page. That payment never changes a grade, a rank, a citation, or a place in any list. StarlynnCare takes no referral commissions. ${rankingSentence}`;
}
