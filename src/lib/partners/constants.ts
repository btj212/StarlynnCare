/** Flat fees only. A per-request price is not offered. */
export const FOUNDING_PARTNER_CAP = 20;

export const PARTNER_PRICE_USD = {
  foundingMonthly: 149,
  foundingAnnual: 1490,
  standardMonthly: 249,
  standardAnnual: 2490,
  operatorMonthly: 199,
} as const;

export const PARTNER_TOUR_CONSENT_VERSION = "2026-10-31";

export const PROFILE_FRESH_DAYS = 30;

export const PARTNER_DESCRIPTION_WORD_LIMIT = 150;

export const PARTNER_PHOTO_LIMIT = 12;

export type PartnerPlan = "founding" | "standard";
export type PartnerInterval = "month" | "year";

export const PARTNER_TERMS = [
  "Payment never changes a grade, rank, citation or position in any list.",
  "No finding is removed, delayed or softened for anyone. A factual correction needs a state source and follows the same process for every community.",
  "Everything a partner adds carries the label “Provided by [Community], a paying partner.”",
  "No community’s page ever shows another community’s ad.",
  "Any licensed community can reply to any finding for free. Replies sit next to the finding, labeled as the community’s.",
  "Code checks the gate every night. A partner that falls below it is paused and its billing pauses; both resume when the record clears.",
  "Prices and openings must be updated every 30 days, or the panel hides them.",
  "Tour requests go only to the community the family chose. They are never sold, shared or rerouted.",
  "Partners can cancel anytime. StarlynnCare can end a partnership over misstated prices or openings.",
  "Each quarter, StarlynnCare publishes how many partners it has and how many were paused.",
] as const;

export function partnerTourConsent(communityName: string): string {
  return `Send my request to ${communityName}. ${communityName} pays StarlynnCare a flat monthly fee as a partner; it doesn't affect grades or rankings.`;
}

export function partnerProvidedLabel(communityName: string): string {
  return `Provided by ${communityName}, a paying partner.`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Prices and openings hide when the community has not confirmed them in 30 days. */
export function partnerPricesAreFresh(
  updatedAt: string | null,
  now = new Date(),
): boolean {
  if (!updatedAt) return false;
  const then = new Date(updatedAt).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then <= PROFILE_FRESH_DAYS * 24 * 60 * 60 * 1000;
}

/** The public block exists only while the partnership, the profile, the gate, and the facility page are all live. */
export function partnerPanelIsPublic(input: {
  status: string;
  published: boolean;
  gatePass: boolean;
  facilityPublishable: boolean;
}): boolean {
  return (
    input.status === "active" &&
    input.published &&
    input.gatePass &&
    input.facilityPublishable
  );
}
