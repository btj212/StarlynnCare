import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getServiceClient } from "@/lib/supabase/server";
import { canonicalFor } from "@/lib/seo/canonical";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { isPartnerBillingConfigured } from "@/lib/partners/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isPartnerBillingConfigured()) {
    return NextResponse.json({ error: "Billing portal is not configured." }, { status: 503 });
  }
  const limit = await rateLimit(`partner-portal:${clientIp(req)}`, 10, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("partners")
    .select("stripe_customer_id, billing_token")
    .eq("billing_token", token)
    .maybeSingle();
  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: canonicalFor(`/partners/billing/${data.billing_token}`),
  });
  return NextResponse.json({ url: session.url });
}
