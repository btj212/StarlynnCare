import type Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase/server";
import { intervalForPriceId, type BillingInterval } from "@/lib/stripe/server";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid";

export type FulfillmentStatus = "pending" | "active" | "paused";

export type FacilityWatchSubscription = {
  id: string;
  facility_id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_interval: BillingInterval;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_token: string;
  firecrawl_monitor_id: string | null;
  fulfillment_status: FulfillmentStatus;
  fulfilled_at: string | null;
  checkout_session_id: string | null;
};

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "incomplete";
  }
}

function periodFromSubscription(sub: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  // Stripe API 2025+: period fields live on the first subscription item.
  const item = sub.items?.data?.[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  const startSec =
    item?.current_period_start ??
    (sub as unknown as { current_period_start?: number }).current_period_start;
  const endSec =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return {
    start: startSec ? new Date(startSec * 1000).toISOString() : null,
    end: endSec ? new Date(endSec * 1000).toISOString() : null,
  };
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  return typeof price === "string" ? price : (price?.id ?? null);
}

export async function upsertPendingCheckout(args: {
  email: string;
  facilityId: string;
  billingInterval: BillingInterval;
  stripePriceId: string;
  checkoutSessionId: string;
}): Promise<FacilityWatchSubscription> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("facility_watch_subscriptions")
    .select("*")
    .eq("email", args.email)
    .eq("facility_id", args.facilityId)
    .maybeSingle();

  if (existing?.status === "active" || existing?.status === "past_due") {
    return existing as FacilityWatchSubscription;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("facility_watch_subscriptions")
      .update({
        billing_interval: args.billingInterval,
        stripe_price_id: args.stripePriceId,
        checkout_session_id: args.checkoutSessionId,
        status: "pending",
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update pending subscription");
    }
    return data as FacilityWatchSubscription;
  }

  const { data, error } = await supabase
    .from("facility_watch_subscriptions")
    .insert({
      email: args.email,
      facility_id: args.facilityId,
      billing_interval: args.billingInterval,
      stripe_price_id: args.stripePriceId,
      checkout_session_id: args.checkoutSessionId,
      status: "pending",
      fulfillment_status: "pending",
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create pending subscription");
  }
  return data as FacilityWatchSubscription;
}

export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  extras?: { email?: string; facilityId?: string },
): Promise<FacilityWatchSubscription | null> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const priceId = priceIdFromSubscription(sub);
  const interval =
    (priceId ? intervalForPriceId(priceId) : null) ??
    (sub.items?.data?.[0]?.price?.recurring?.interval === "year"
      ? "year"
      : "month");
  const period = periodFromSubscription(sub);
  const status = mapStripeStatus(sub.status);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  const email =
    extras?.email ??
    (typeof sub.metadata?.email === "string" ? sub.metadata.email : null);
  const facilityId =
    extras?.facilityId ??
    (typeof sub.metadata?.facility_id === "string"
      ? sub.metadata.facility_id
      : null);

  const { data: bySubId } = await supabase
    .from("facility_watch_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  let row = bySubId as FacilityWatchSubscription | null;

  if (!row && email && facilityId) {
    const { data } = await supabase
      .from("facility_watch_subscriptions")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("facility_id", facilityId)
      .maybeSingle();
    row = data as FacilityWatchSubscription | null;
  }

  const patch = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    billing_interval: interval as BillingInterval,
    status,
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    updated_at: now,
    // Pause fulfillment when canceled; keep pending until operator activates.
    ...(status === "canceled"
      ? { fulfillment_status: "paused" as const }
      : {}),
  };

  if (row) {
    const { data, error } = await supabase
      .from("facility_watch_subscriptions")
      .update(patch)
      .eq("id", row.id)
      .select("*")
      .single();
    if (error || !data) {
      console.error("[facility-watch] sync update failed:", error?.message);
      return null;
    }
    return data as FacilityWatchSubscription;
  }

  if (!email || !facilityId) {
    console.error(
      "[facility-watch] cannot create subscription row — missing email/facility_id on Stripe sub",
      sub.id,
    );
    return null;
  }

  const { data, error } = await supabase
    .from("facility_watch_subscriptions")
    .upsert(
      {
        email: email.toLowerCase(),
        facility_id: facilityId,
        ...patch,
        fulfillment_status: status === "active" ? "pending" : "pending",
      },
      { onConflict: "email,facility_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("[facility-watch] sync upsert failed:", error?.message);
    return null;
  }
  return data as FacilityWatchSubscription;
}

export async function getSubscriptionByBillingToken(
  token: string,
): Promise<FacilityWatchSubscription | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("facility_watch_subscriptions")
    .select("*")
    .eq("billing_token", token)
    .maybeSingle();
  if (error) {
    console.error("[facility-watch] billing token lookup failed:", error.message);
    return null;
  }
  return data as FacilityWatchSubscription | null;
}

export async function claimStripeEvent(args: {
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<"new" | "duplicate"> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("billing_webhook_events").insert({
    stripe_event_id: args.eventId,
    event_type: args.eventType,
    payload: args.payload as Record<string, unknown>,
  });
  if (error) {
    // Unique violation → already processed
    if (error.code === "23505") return "duplicate";
    throw new Error(`[stripe-webhook] claim failed: ${error.message}`);
  }
  return "new";
}
