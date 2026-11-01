import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";
import { canonicalFor } from "@/lib/seo/canonical";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { sendPartnerTourToCommunity } from "@/lib/email/partnerTour";
import { isFacilityUuid } from "@/lib/partners/gate";
import { loadPublicPartnerPanel } from "@/lib/partners/panel";
import { partnerTourConsent } from "@/lib/partners/constants";

export const runtime = "nodejs";

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`partner-tour:${clientIp(req)}`, 5, 15 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (looksLikeBot(body[HONEYPOT_FIELD], body[HONEYPOT_TS_FIELD])) {
    return NextResponse.json({ ok: true });
  }

  const facilityId = clip(body.facilityId, 40);
  const familyName = clip(body.name, 120);
  const familyEmail = clip(body.email, 254).toLowerCase();
  const familyPhone = clip(body.phone, 40);
  const relationship = clip(body.relationship, 80);
  const timing = clip(body.timing, 80);
  const consentText = clip(body.consentText, 500);
  const consentVersion = clip(body.consentVersion, 40);

  if (!isFacilityUuid(facilityId) || !familyName || !isValidEmail(familyEmail) || !relationship || !timing) {
    return NextResponse.json({ error: "Name, email, relationship, and timing are required." }, { status: 400 });
  }

  const panel = await loadPublicPartnerPanel(facilityId);
  if (!panel) {
    return NextResponse.json({ error: "This community is not taking tour requests here." }, { status: 404 });
  }
  const expected = partnerTourConsent(panel.communityName);
  if (consentText !== expected || consentVersion !== panel.consentVersion) {
    return NextResponse.json({ error: "The consent text is out of date. Reload the page and try again." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("partner_profiles")
    .select("tour_contact_email")
    .eq("facility_id", facilityId)
    .maybeSingle();
  const tourEmail =
    typeof profile?.tour_contact_email === "string" ? profile.tour_contact_email.trim().toLowerCase() : "";

  const { data: inserted, error } = await supabase
    .from("tour_requests")
    .insert({
      facility_id: facilityId,
      family_name: familyName,
      family_email: familyEmail,
      family_phone: familyPhone || null,
      relationship,
      move_in_timing: timing,
      consent_text: expected,
      consent_version: panel.consentVersion,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[partners] tour insert failed:", error?.message);
    return NextResponse.json({ error: "The request could not be saved." }, { status: 500 });
  }

  let deliveryError: string | null = null;
  let delivered = false;
  if (!isValidEmail(tourEmail)) {
    deliveryError = "community_contact_missing";
  } else {
    const sent = await sendPartnerTourToCommunity({
      to: tourEmail,
      communityName: panel.communityName,
      familyName,
      familyEmail,
      familyPhone,
      relationship,
      timing,
      consent: expected,
      facilityUrl: canonicalFor(panel.facilityPath),
    });
    delivered = sent.ok;
    deliveryError = sent.ok ? null : sent.error;
  }

  const now = new Date().toISOString();
  await supabase
    .from("tour_requests")
    .update({
      delivered_at: delivered ? now : null,
      delivery_error: deliveryError,
    })
    .eq("id", inserted.id);

  recordSubmission({
    type: "partner_tour",
    email: familyEmail,
    facilityId,
    source: "partner_panel",
    summary: `Tour request for ${panel.communityName}`,
    payload: {
      communityName: panel.communityName,
      relationship,
      timing,
      delivered,
      deliveryError,
      consentVersion: panel.consentVersion,
    },
  }).catch((err) => console.error("[partners] tour ledger failed:", err));

  if (!delivered) {
    return NextResponse.json({
      ok: true,
      delivered: false,
      message: "We saved your request and alerted StarlynnCare. We could not confirm delivery to the community.",
    });
  }
  return NextResponse.json({
    ok: true,
    delivered: true,
    message: `Your request went only to ${panel.communityName}.`,
  });
}
