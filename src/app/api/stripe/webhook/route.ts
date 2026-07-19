import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import {
  claimStripeEvent,
  syncSubscriptionFromStripe,
} from "@/lib/facility-watch/subscriptions";
import { getServiceClient } from "@/lib/supabase/server";
import {
  sendPaidWatchWelcome,
  sendPaidWatchPaymentFailed,
} from "@/lib/email/paidWatch";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { canonicalFor } from "@/lib/seo/canonical";
import { stateFromCode } from "@/lib/states";
import { formatFacilityName } from "@/lib/facility/displayName";

export const runtime = "nodejs";

/** Stripe API 2025+: subscription id lives on invoice.parent.subscription_details. */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (!details?.subscription) return null;
  return typeof details.subscription === "string"
    ? details.subscription
    : details.subscription.id;
}

async function loadFacilityLabel(facilityId: string): Promise<{
  name: string;
  path: string;
}> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("facilities")
    .select("name, slug, city_slug, state_code")
    .eq("id", facilityId)
    .maybeSingle();
  if (!data) {
    return { name: "your facility", path: "/" };
  }
  const stateSlug =
    stateFromCode(data.state_code)?.slug ?? data.state_code.toLowerCase();
  return {
    name: formatFacilityName(data.name),
    path: `/${stateSlug}/${data.city_slug}/${data.slug}`,
  };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;
  if (session.metadata?.product !== "facility_watch_paid") return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) {
    console.error("[stripe-webhook] checkout.session.completed missing subscription");
    return;
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const email =
    session.customer_details?.email?.toLowerCase() ??
    session.customer_email?.toLowerCase() ??
    session.metadata?.email?.toLowerCase() ??
    undefined;
  const facilityId = session.metadata?.facility_id;

  const row = await syncSubscriptionFromStripe(sub, {
    email,
    facilityId: facilityId ?? undefined,
  });
  if (!row || row.status !== "active") return;

  // Premium includes official-record alerts — ensure an alert-eligible watcher row.
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  await supabase
    .from("facility_watchers")
    .upsert(
      {
        email: row.email,
        facility_id: row.facility_id,
        source: "paid_facility_watch",
        confirmed_at: now,
        baseline_at: now,
        intent: "resident",
        alerts_eligible: true,
      },
      { onConflict: "email,facility_id", ignoreDuplicates: false },
    )
    .then(({ error }) => {
      if (error) {
        console.error(
          "[stripe-webhook] official-alert watcher upsert failed:",
          error.message,
        );
      }
    });

  const facility = await loadFacilityLabel(row.facility_id);
  const manageUrl = canonicalFor(`/watch/billing/${row.billing_token}`);
  const facilityUrl = canonicalFor(facility.path);

  await sendPaidWatchWelcome({
    to: row.email,
    facilityName: facility.name,
    facilityUrl,
    billingInterval: row.billing_interval,
    manageUrl,
  }).catch((err) =>
    console.error("[stripe-webhook] paid welcome failed:", err),
  );

  recordSubmission({
    // Reuse the existing allowed DB event type; source distinguishes paid.
    // This avoids an unrelated submission_events constraint rewrite in 0063.
    type: "facility_watch",
    email: row.email,
    source: "stripe_checkout_paid",
    facilityId: row.facility_id,
    summary: `Paid Facility Watch · ${facility.name} · ${row.billing_interval}`,
    payload: {
      facilityName: facility.name,
      billingInterval: row.billing_interval,
      stripeSubscriptionId: row.stripe_subscription_id,
      fulfillmentStatus: row.fulfillment_status,
      manageUrl,
      actionRequired: "Create or attach Firecrawl monitor within one business day.",
    },
  }).catch((err) =>
    console.error("[stripe-webhook] recordSubmission failed:", err),
  );
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  if (sub.metadata?.product !== "facility_watch_paid") {
    // Still sync if we already track this subscription id.
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("facility_watch_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    if (!data) return;
  }
  await syncSubscriptionFromStripe(sub);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await syncSubscriptionFromStripe(sub);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const row = await syncSubscriptionFromStripe(sub);
  if (!row) return;

  const facility = await loadFacilityLabel(row.facility_id);
  const manageUrl = canonicalFor(`/watch/billing/${row.billing_token}`);

  await sendPaidWatchPaymentFailed({
    to: row.email,
    facilityName: facility.name,
    manageUrl,
  }).catch((err) =>
    console.error("[stripe-webhook] payment-failed email failed:", err),
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let claim: "new" | "duplicate";
  try {
    claim = await claimStripeEvent({
      eventId: event.id,
      eventType: event.type,
      payload: { id: event.id, type: event.type },
    });
  } catch (err) {
    console.error("[stripe-webhook] claim error:", err);
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }

  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    // Release the claim so Stripe can retry a transient failure.
    const supabase = getServiceClient();
    await supabase
      .from("billing_webhook_events")
      .delete()
      .eq("stripe_event_id", event.id);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
