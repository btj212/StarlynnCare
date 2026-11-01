export type PartnerBillingStatus =
  | "pending"
  | "active"
  | "paused"
  | "past_due"
  | "canceled";

export type PartnerPauseReason = "gate" | "manual";

/**
 * Stripe reports `active` while collection is paused. A gate or manual pause
 * stays paused until the nightly job, after the gate passes, clears a gate
 * pause. A manual pause is never cleared here.
 */
export function partnerStatusAfterStripeEvent(input: {
  stripeStatus: "active" | "past_due" | "canceled" | "pending";
  pauseCollection: boolean;
  existingPauseReason: PartnerPauseReason | null;
}): {
  status: PartnerBillingStatus;
  pauseReason: PartnerPauseReason | null;
  collectionPaused: boolean;
} {
  if (input.stripeStatus === "canceled") {
    return { status: "canceled", pauseReason: null, collectionPaused: false };
  }
  if (input.pauseCollection) {
    return {
      status: "paused",
      pauseReason: input.existingPauseReason === "manual" ? "manual" : "gate",
      collectionPaused: true,
    };
  }
  if (input.existingPauseReason === "manual" || input.existingPauseReason === "gate") {
    return {
      status: "paused",
      pauseReason: input.existingPauseReason,
      collectionPaused: false,
    };
  }
  if (input.stripeStatus === "past_due") {
    return { status: "past_due", pauseReason: null, collectionPaused: false };
  }
  if (input.stripeStatus === "active") {
    return { status: "active", pauseReason: null, collectionPaused: false };
  }
  return { status: "pending", pauseReason: null, collectionPaused: false };
}
