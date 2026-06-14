/**
 * Facility offer variants for the WTP test.
 *
 * Each facility gets one assigned variant, deterministic by facility.id —
 * stable across page loads, cache-safe, no per-visitor randomization needed.
 *
 * Reading the test results:
 *   Click rate  → Clarity dashboard, filter sessions by `offerVariant` tag.
 *   Conversions → /admin/submissions filtered by source = "offer_<variant>".
 */

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
  /** "email" = opens modal with email capture; "route" = navigates to href */
  kind: "email" | "route";
  /** Only set when kind === "route" */
  href?: string;
  /** journeyStage sent to /api/watch */
  journeyStage: string;
};

export const OFFERS: Offer[] = [
  {
    id: "watch",
    eyebrow: "Free · Facility Watch",
    headline: "Get notified when this record changes.",
    sub: "New citations, complaint investigations, or status changes — emailed to you free.",
    ctaLabel: "Watch this facility free →",
    ctaLabelCompact: "Watch →",
    kind: "email",
    journeyStage: "search",
  },
  {
    id: "records",
    eyebrow: "Free · Full Inspection Record",
    headline: "Get this facility's complete inspection record, in plain language.",
    sub: "Every inspection since 2021 — citations, complaint outcomes, and findings — translated and emailed to you.",
    ctaLabel: "Get the full record →",
    ctaLabelCompact: "Full record →",
    kind: "email",
    journeyStage: "decision",
  },
  {
    id: "contract",
    eyebrow: "Free · Contract Decoder",
    headline: "Decode an admission agreement before you sign.",
    sub: "Send us the contract — we map every fee escalation, discharge trigger, and arbitration clause in plain language.",
    ctaLabel: "Decode the contract →",
    ctaLabelCompact: "Contract →",
    kind: "route",
    href: "/tools/contract-review?ref=offer_contract",
    journeyStage: "decision",
  },
  {
    id: "tour",
    eyebrow: "Free · Tour Prep",
    headline: "Get a tour-prep pack for this facility.",
    sub: "A printable checklist of questions specific to this facility's citation history — so you ask about the right things on tour.",
    ctaLabel: "Get the tour-prep pack →",
    ctaLabelCompact: "Tour prep →",
    kind: "email",
    journeyStage: "decision",
  },
];

const OFFER_IDS = OFFERS.map((o) => o.id);

/**
 * Deterministically assign an offer variant to a facility.
 * Uses a simple char-sum hash of the UUID so every facility always
 * gets the same offer and pages remain ISR-cache-safe.
 */
export function assignOffer(facilityId: string): Offer {
  let sum = 0;
  for (let i = 0; i < facilityId.length; i++) {
    sum += facilityId.charCodeAt(i);
  }
  const idx = sum % OFFERS.length;
  return OFFERS[idx];
}

export function getOfferById(id: OfferId): Offer {
  return OFFERS.find((o) => o.id === id) ?? OFFERS[0];
}
