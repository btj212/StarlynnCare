import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { canonicalFor } from "@/lib/seo/canonical";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";
import { formatFacilityName } from "@/lib/facility/displayName";
import { stateFromCode } from "@/lib/states";
import {
  isPartnerBillingConfigured,
  isPartnerCheckoutEnabled,
  priceIdForPartnerPlan,
} from "@/lib/partners/config";
import { isFacilityUuid } from "@/lib/partners/gate";
import type { PartnerInterval, PartnerPlan } from "@/lib/partners/constants";

export const runtime = "nodejs";

type ReserveResult = {
  ok?: boolean;
  reason?: string;
  partner_id?: string;
  billing_token?: string;
};

export async function POST(req: NextRequest) {
  if (!isPartnerCheckoutEnabled()) {
    return NextResponse.json(
      { error: "Checkout is closed until the terms are reviewed and the insurance is in place." },
      { status: 403 },
    );
  }
  if (!isPartnerBillingConfigured()) {
    return NextResponse.json({ error: "Partner billing is not configured." }, { status: 503 });
  }

  const limit = await rateLimit(`partner-checkout:${clientIp(req)}`, 8, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: {
    email?: string;
    facilityId?: string;
    plan?: string;
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
    return NextResponse.json({ ok: true, url: canonicalFor("/partners") });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const facilityId = typeof body.facilityId === "string" ? body.facilityId : "";
  const plan: PartnerPlan | null = body.plan === "founding" || body.plan === "standard" ? body.plan : null;
  const interval: PartnerInterval | null =
    body.interval === "month" || body.interval === "year" ? body.interval : null;
  if (!isValidEmail(email) || !isFacilityUuid(facilityId) || !plan || !interval) {
    return NextResponse.json({ error: "Check the community, email, and plan." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: reserved, error: reserveError } = await supabase.rpc("reserve_partner_checkout", {
    p_facility_id: facilityId,
    p_email: email,
    p_plan: plan,
    p_interval: interval,
  });
  if (reserveError) {
    console.error("[partners] reserve failed:", reserveError.message);
    return NextResponse.json({ error: "Checkout could not be reserved." }, { status: 503 });
  }
  const result = reserved as ReserveResult;
  if (!result.ok) {
    if (result.reason === "already_active" && result.billing_token) {
      return NextResponse.json({
        ok: true,
        alreadyActive: true,
        manageUrl: canonicalFor(`/partners/billing/${result.billing_token}`),
      });
    }
    const message =
      result.reason === "founding_full"
        ? "The founding rate is full. The standard rate is still open."
        : result.reason === "gate"
          ? "This community does not clear the partner gate."
          : "Checkout could not be reserved.";
    return NextResponse.json({ error: message, reason: result.reason ?? "reserved" }, { status: 409 });
  }

  const { data: facility } = await supabase
    .from("facilities")
    .select("name, slug, city_slug, state_code")
    .eq("id", facilityId)
    .maybeSingle();
  if (!facility) {
    return NextResponse.json({ error: "Unknown community." }, { status: 404 });
  }
  const stateSlug = stateFromCode(facility.state_code)?.slug ?? facility.state_code.toLowerCase();
  const displayName = formatFacilityName(facility.name);
  const priceId = priceIdForPartnerPlan(plan, interval);
  const stripe = getStripe();
  const metadata = {
    product: "verified_partner",
    email,
    facility_id: facilityId,
    facility_name: displayName,
    partner_id: result.partner_id ?? "",
    plan,
    billing_interval: interval,
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: canonicalFor("/partners/success?session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: canonicalFor(`/${stateSlug}/${facility.city_slug}/${facility.slug}`),
      client_reference_id: facilityId,
      metadata,
      subscription_data: { metadata },
    },
    {
      idempotencyKey: `partner-checkout:${facilityId}:${plan}:${interval}:${Math.floor(Date.now() / 60_000)}`,
    },
  );
  if (!session.url || !result.partner_id) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
  const { error: sessionError } = await supabase
    .from("partners")
    .update({ checkout_session_id: session.id, stripe_price_id: priceId, updated_at: new Date().toISOString() })
    .eq("id", result.partner_id);
  if (sessionError) {
    console.error("[partners] session id save failed:", sessionError.message);
  }
  return NextResponse.json({ ok: true, url: session.url });
}
