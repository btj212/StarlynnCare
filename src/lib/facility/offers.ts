/**
 * Facility offer variants for the WTP test.
 *
 * Each facility gets one assigned variant, deterministic by facility.id —
 * stable across page loads, cache-safe, no per-visitor randomization needed.
 *
 * Reading the test results:
 *   Click rate  → Clarity dashboard, filter sessions by `offerVariant` tag.
 *   Conversions → /admin/submissions filtered by source = "offer_<variant>".
 *
 * The "watch" variant is Facility Watch Premium (paid). It is only assigned
 * when paid Facility Watch is enabled for the state.
 */

import {
  PAID_WATCH_ANCHOR,
  PAID_WATCH_MONTHLY_USD,
  shouldShowPaidFacilityWatch,
} from "@/lib/facility-watch/paidConfig";

export type OfferId = "watch" | "records" | "contract" | "tour";

export type Offer = {
  id: OfferId;
  eyebrow: string;
  headline: string;
  sub: string;
  /** Label on the trigger button */
  ctaLabel: string;
  /** compact label for the sticky/bottom bar */
  ctaLabelCompact: string;
  /** "email" = modal capture; "route" = navigate; "anchor" = scroll to on-page Premium */
  kind: "email" | "route" | "anchor";
  /** Set when kind is "route" or "anchor" */
  href?: string;
  /** journeyStage sent to /api/watch for email offers */
  journeyStage: string;
};

export const OFFERS: Offer[] = [
  {
    id: "watch",
    eyebrow: "Facility Watch · Premium",
    headline: "Does your loved one live here already?",
    sub: `We monitor official inspection records plus news and public review mentions we can find across the web — $${PAID_WATCH_MONTHLY_USD}/month.`,
    ctaLabel: "Start Facility Watch →",
    ctaLabelCompact: "Watch →",
    kind: "anchor",
    href: `#${PAID_WATCH_ANCHOR}`,
    journeyStage: "resident",
  },
  {
    id: "records",
    eyebrow: "Full Inspection Record",
    headline: "Get this facility's complete inspection record, in plain language.",
    sub: "Every inspection since 2021 — citations, complaint outcomes, and findings — translated and emailed to you.",
    ctaLabel: "Get the full record →",
    ctaLabelCompact: "Full record →",
    kind: "email",
    journeyStage: "decision",
  },
  {
    id: "contract",
    eyebrow: "Contract Decoder",
    headline: "Decode an admission agreement before you sign.",
    sub: "Send us the contract — we map every fee escalation, discharge trigger, and arbitration clause in plain language.",
    ctaLabel: "Decode the contract →",
    ctaLabelCompact: "Vet contract →",
    kind: "route",
    href: "/tools/contract-review?ref=offer_contract",
    journeyStage: "decision",
  },
  {
    id: "tour",
    eyebrow: "Tour Prep",
    headline: "Get a tour-prep pack for this facility.",
    sub: "A printable checklist of questions specific to this facility's citation history — so you ask about the right things on tour.",
    ctaLabel: "Get the tour-prep pack →",
    ctaLabelCompact: "Tour checklist →",
    kind: "email",
    journeyStage: "decision",
  },
];

/**
 * Deterministically assign an offer variant to a facility.
 * Uses a simple char-sum hash of the UUID so every facility always
 * gets the same offer and pages remain ISR-cache-safe.
 *
 * Paid Facility Watch is excluded from the pool when the launch flag is off
 * or the state is not eligible (TX/MO).
 */
export function assignOffer(
  facilityId: string,
  stateCode?: string | null,
): Offer {
  const pool = shouldShowPaidFacilityWatch(stateCode)
    ? OFFERS
    : OFFERS.filter((o) => o.id !== "watch");
  let sum = 0;
  for (let i = 0; i < facilityId.length; i++) {
    sum += facilityId.charCodeAt(i);
  }
  const idx = sum % pool.length;
  return pool[idx] ?? OFFERS[1];
}

export function getOfferById(id: OfferId): Offer {
  return OFFERS.find((o) => o.id === id) ?? OFFERS[1];
}
