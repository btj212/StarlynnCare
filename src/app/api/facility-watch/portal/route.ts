import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getSubscriptionByBillingToken } from "@/lib/facility-watch/subscriptions";
import { canonicalFor } from "@/lib/seo/canonical";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing portal is not configured." },
      { status: 503 },
    );
  }

  const limit = await rateLimit(`fw-portal:${clientIp(req)}`, 10, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const row = await getSubscriptionByBillingToken(token);
  if (!row?.stripe_customer_id) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: canonicalFor(`/watch/billing/${row.billing_token}`),
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not open billing portal" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, url: session.url });
}
