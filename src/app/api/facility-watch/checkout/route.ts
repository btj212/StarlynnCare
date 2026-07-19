import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, priceIdForInterval } from "@/lib/stripe/server";
import type { BillingInterval } from "@/lib/stripe/server";
import {
  isPaidFacilityWatchEnabled,
  isPaidWatchStateEligible,
} from "@/lib/facility-watch/paidConfig";
import { upsertPendingCheckout } from "@/lib/facility-watch/subscriptions";
import { canonicalFor } from "@/lib/seo/canonical";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";
import { stateFromCode } from "@/lib/states";
import { formatFacilityName } from "@/lib/facility/displayName";

export async function POST(req: NextRequest) {
  if (!isPaidFacilityWatchEnabled() || !isStripeConfigured()) {
    return NextResponse.json(
      { error: "Paid Facility Watch is not available yet." },
      { status: 503 },
    );
  }

  const limit = await rateLimit(`fw-checkout:${clientIp(req)}`, 8, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    facilityId?: string;
    interval?: string;
    [HONEYPOT_FIELD]?: unknown;
    [HONEYPOT_TS_FIELD]?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (looksLikeBot(body[HONEYPOT_FIELD], body[HONEYPOT_TS_FIELD])) {
    return NextResponse.json({ ok: true, url: canonicalFor("/") });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const facilityId = typeof body.facilityId === "string" ? body.facilityId : "";
  const interval: BillingInterval =
    body.interval === "year" ? "year" : body.interval === "month" ? "month" : ("month" as const);

  if (!email || !facilityId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (body.interval !== "month" && body.interval !== "year") {
    return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: facility, error: facilityError } = await supabase
    .from("facilities")
    .select("id, name, slug, city_slug, state_code")
    .eq("id", facilityId)
    .maybeSingle();

  if (facilityError || !facility) {
    return NextResponse.json({ error: "Facility not found" }, { status: 404 });
  }

  if (!isPaidWatchStateEligible(facility.state_code)) {
    return NextResponse.json(
      { error: "Paid Facility Watch is not available for this state yet." },
      { status: 400 },
    );
  }

  const stateSlug =
    stateFromCode(facility.state_code)?.slug ?? facility.state_code.toLowerCase();
  const displayName = formatFacilityName(facility.name);

  const { data: existing } = await supabase
    .from("facility_watch_subscriptions")
    .select("id, status, billing_token")
    .eq("email", email)
    .eq("facility_id", facilityId)
    .maybeSingle();

  if (existing?.status === "active" || existing?.status === "past_due") {
    return NextResponse.json({
      ok: true,
      alreadyActive: true,
      manageUrl: canonicalFor(`/watch/billing/${existing.billing_token}`),
    });
  }

  const priceId = priceIdForInterval(interval);
  const stripe = getStripe();
  const facilityPath = `/${stateSlug}/${facility.city_slug}/${facility.slug}`;
  const successUrl = canonicalFor(
    `/watch/paid/success?session_id={CHECKOUT_SESSION_ID}`,
  );
  const cancelUrl = canonicalFor(facilityPath);

  // Create a provisional checkout session id placeholder row after session create.
  // We create the Stripe session first, then upsert with its id.
  let customerId: string | undefined;
  if (existing) {
    const { data: full } = await supabase
      .from("facility_watch_subscriptions")
      .select("stripe_customer_id")
      .eq("id", existing.id)
      .maybeSingle();
    if (full?.stripe_customer_id) {
      customerId = full.stripe_customer_id;
    }
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: facilityId,
      metadata: {
        email,
        facility_id: facilityId,
        facility_name: displayName,
        billing_interval: interval,
        product: "facility_watch_paid",
      },
      subscription_data: {
        metadata: {
          email,
          facility_id: facilityId,
          facility_name: displayName,
          billing_interval: interval,
          product: "facility_watch_paid",
        },
      },
    },
    {
      // Minute bucket: collapses double-clicks without pinning an expired session forever.
      idempotencyKey: `fw-checkout:${email}:${facilityId}:${interval}:${Math.floor(Date.now() / 60_000)}`,
    },
  );

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 },
    );
  }

  try {
    await upsertPendingCheckout({
      email,
      facilityId,
      billingInterval: interval,
      stripePriceId: priceId,
      checkoutSessionId: session.id,
    });
  } catch (err) {
    console.error("[facility-watch/checkout] pending upsert failed:", err);
    // Session still usable — webhook will create the row from metadata.
  }

  return NextResponse.json({ ok: true, url: session.url });
}
