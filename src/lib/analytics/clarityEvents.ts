/**
 * Clarity custom events for the facility offer CTA test.
 *
 * Microsoft Clarity (loaded in layout.tsx as `window.clarity`) is the live
 * analytics instrument on this site. All functions are no-ops when Clarity
 * is absent so they are safe to call unconditionally in SSR/RSC code paths
 * (just don't import this in server components — keep it "use client" only).
 *
 * Reading results:
 *   Clarity dashboard → Segments → filter by Custom Tag "offerVariant" = "records" etc.
 *   Then compare event counts: offer_impression vs offer_click vs offer_convert.
 */

declare global {
  interface Window {
    clarity?: (method: string, ...args: unknown[]) => void;
  }
}

function c(...args: Parameters<NonNullable<Window["clarity"]>>) {
  if (typeof window !== "undefined" && typeof window.clarity === "function") {
    window.clarity(...args);
  }
}

/**
 * Tag the Clarity session with the variant shown on this facility page.
 * Call once on mount from FacilityOfferProvider.
 */
export function setOfferVariant(variant: string) {
  c("set", "offerVariant", variant);
}

/**
 * Fire when the offer CTA first becomes visible in the DOM.
 * Call once on mount from FacilityOfferProvider.
 */
export function emitOfferImpression(variant: string) {
  c("event", "offer_impression", { variant });
}

/**
 * Fire when the user clicks the CTA button (before modal opens / route starts).
 */
export function emitOfferClick(variant: string) {
  c("event", "offer_click", { variant });
}

/**
 * Fire when the user successfully submits their email in the offer modal.
 */
export function emitOfferConvert(variant: string) {
  c("event", "offer_convert", { variant });
}

/** Paid Facility Watch — impression when the inline paid CTA mounts. */
export function emitPaidWatchImpression() {
  c("event", "paid_watch_impression");
}

/** Paid Facility Watch — user selected monthly or annual plan. */
export function emitPaidWatchPlanSelect(interval: "month" | "year") {
  c("event", "paid_watch_plan_select", { interval });
}

/** Paid Facility Watch — redirected to Stripe Checkout. */
export function emitPaidWatchCheckoutStart(interval: "month" | "year") {
  c("event", "paid_watch_checkout_start", { interval });
}

/** Paid Facility Watch — success page loaded after checkout. */
export function emitPaidWatchActivated() {
  c("event", "paid_watch_activated");
}
