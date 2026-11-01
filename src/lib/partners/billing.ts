import type Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { partnerPlanForPriceId } from "@/lib/partners/config";
import {
  partnerStatusAfterStripeEvent,
  type PartnerBillingStatus,
  type PartnerPauseReason,
} from "@/lib/partners/lifecycle";

const PRODUCT = "verified_partner";

type PartnerRow = {
  id: string;
  facility_id: string;
  contact_email: string;
  plan: "founding" | "standard";
  billing_interval: "month" | "year";
  status: PartnerBillingStatus;
  is_founding: boolean;
  pause_reason: PartnerPauseReason | null;
  collection_paused: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_token: string;
  admitted_at: string | null;
  canceled_at: string | null;
};

function pauseReason(value: string | null): PartnerPauseReason | null {
  return value === "gate" || value === "manual" ? value : null;
}

function stripeBucket(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "pending" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "pending";
  }
}

function priceIdFrom(sub: Stripe.Subscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  return typeof price === "string" ? price : (price?.id ?? null);
}

function customerIdFrom(sub: Stripe.Subscription): string | null {
  if (!sub.customer) return null;
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

export function isVerifiedPartnerSubscription(sub: Stripe.Subscription): boolean {
  return sub.metadata?.product === PRODUCT;
}

export async function partnerSubscriptionExists(subscriptionId: string): Promise<boolean> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("partners")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return Boolean(data);
}

export async function syncPartnerFromStripe(sub: Stripe.Subscription): Promise<PartnerRow | null> {
  const supabase = getServiceClient();
  const facilityId = sub.metadata?.facility_id;
  let query = supabase.from("partners").select("*");
  query = facilityId
    ? query.eq("facility_id", facilityId)
    : query.eq("stripe_subscription_id", sub.id);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[partners] sync lookup failed:", error.message);
    return null;
  }
  if (!data) {
    console.error("[partners] no reserved row for subscription", sub.id);
    return null;
  }
  const existing = data as PartnerRow;
  const next = partnerStatusAfterStripeEvent({
    stripeStatus: stripeBucket(sub.status),
    pauseCollection: Boolean(sub.pause_collection),
    existingPauseReason: pauseReason(existing.pause_reason),
  });
  const priceId = priceIdFrom(sub);
  const mapped = priceId ? partnerPlanForPriceId(priceId) : null;
  let plan = existing.plan;
  let interval = existing.billing_interval;
  if (existing.is_founding) {
    plan = "founding";
    if (mapped?.plan === "founding") interval = mapped.interval;
  } else if (mapped && mapped.plan !== "founding") {
    plan = mapped.plan;
    interval = mapped.interval;
  } else if (mapped?.plan === "founding") {
    console.error("[partners] refusing a founding price on a standard row", sub.id);
  }
  const now = new Date().toISOString();
  const { data: saved, error: updateError } = await supabase
    .from("partners")
    .update({
      status: next.status,
      pause_reason: next.pauseReason,
      collection_paused: next.collectionPaused,
      plan,
      billing_interval: interval,
      stripe_customer_id: customerIdFrom(sub) ?? existing.stripe_customer_id,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      checkout_reserved_until: null,
      canceled_at: next.status === "canceled" ? (existing.canceled_at ?? now) : null,
      admitted_at:
        existing.admitted_at ??
        (next.status === "active" || next.status === "paused" || next.status === "past_due" ? now : null),
      updated_at: now,
    })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (updateError || !saved) {
    console.error("[partners] sync update failed:", updateError?.message);
    return null;
  }
  return saved as PartnerRow;
}

export async function pausePartnerCollection(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptions.update(subscriptionId, {
    pause_collection: { behavior: "void" },
  });
}

export async function resumePartnerCollection(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptions.update(subscriptionId, {
    pause_collection: "",
  });
}

export async function cancelPartnerSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptions.cancel(subscriptionId);
}
