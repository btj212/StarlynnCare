/**
 * Facility-page offer.
 *
 * The 2026 rotation test is over. Records requests were the only offer
 * families kept using, so every profile shows that offer. A checked box on
 * that form starts free inspection alerts. Tour prep and contract review are
 * offered after someone asks for the record, not instead of it.
 */

export type OfferId = "records" | "contract" | "tour";

export type Offer = {
  id: OfferId;
  eyebrow: string;
  headline: string;
  sub: string;
  /** Label on the trigger button */
  ctaLabel: string;
  /** compact label for the sticky/bottom bar */
  ctaLabelCompact: string;
  /** "email" = modal capture; "route" = navigate */
  kind: "email" | "route";
  /** Set when kind is "route" */
  href?: string;
  /** journeyStage sent to /api/watch for email offers */
  journeyStage: string;
};

export const OFFERS: Offer[] = [
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

/** Every facility page offers the full inspection record. */
export function assignOffer(
  _facilityId: string,
  _stateCode?: string | null,
): Offer {
  return getOfferById("records");
}

export function getOfferById(id: OfferId): Offer {
  return OFFERS.find((o) => o.id === id) ?? OFFERS[0];
}
