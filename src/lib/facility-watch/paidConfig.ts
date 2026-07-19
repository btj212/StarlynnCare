/**
 * Paid Facility Watch — launch config (concierge MVP).
 *
 * Production visibility requires FACILITY_WATCH_PAID_ENABLED=1 plus Stripe
 * price/secret env vars. Unsupported states never show the paid CTA.
 */

/** States whose official-record weekly scan is not yet dependable enough for paid promises. */
export const PAID_WATCH_EXCLUDED_STATE_CODES = new Set(["TX", "MO"]);

export const PAID_WATCH_MONTHLY_USD = 9;
export const PAID_WATCH_ANNUAL_USD = 59;

/** On-page anchor for sticky/offer CTAs that scroll to Premium. */
export const PAID_WATCH_ANCHOR = "facility-watch-premium";

export function isPaidFacilityWatchEnabled(): boolean {
  return process.env.FACILITY_WATCH_PAID_ENABLED === "1";
}

export function isPaidWatchStateEligible(
  stateCode: string | null | undefined,
): boolean {
  if (!stateCode) return false;
  return !PAID_WATCH_EXCLUDED_STATE_CODES.has(stateCode.toUpperCase());
}

/** True when the profile should render the paid CTA. */
export function shouldShowPaidFacilityWatch(
  stateCode: string | null | undefined,
): boolean {
  return isPaidFacilityWatchEnabled() && isPaidWatchStateEligible(stateCode);
}
