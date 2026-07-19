import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { sendWatchWelcome, sendRecordsEmail, sendTourEmail } from "@/lib/email/watch";
import { buildWatchWelcomeDigest } from "@/lib/watch/buildWatchWelcomeDigest";
import { buildTourEmailDigest } from "@/lib/email/buildTourEmailDigest";
import { addLoopsContact } from "@/lib/loops";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";

/**
 * Retired free Facility Watch enrollment sources. New visitors cannot open an
 * ongoing official-alert watch this way — use paid Facility Watch instead.
 * Existing facility_watchers rows remain eligible for dispatch.
 */
const RETIRED_FREE_WATCH_SOURCES = new Set([
  "inline_strip",
  "sticky_bar",
  "modal",
  "offer_watch",
  "facility_hero",
  "facility_watch",
]);

/** One-time email products that may still write a facility_watchers row. */
const ONE_TIME_EMAIL_SOURCES = new Set([
  "offer_records",
  "offer_tour",
  "records_pull_interest",
  "report_waitlist",
]);

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`watch:${clientIp(req)}`, 5, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    facilityId?: string;
    facilityName?: string;
    source?: string;
    intent?: string;
    [HONEYPOT_FIELD]?: unknown;
    [HONEYPOT_TS_FIELD]?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot + timing trap. Return 200 so bots don't learn they were blocked.
  if (looksLikeBot(body[HONEYPOT_FIELD], body[HONEYPOT_TS_FIELD])) {
    return NextResponse.json({ ok: true });
  }

  const { email, facilityId, facilityName, source, intent } = body;

  if (!email || !facilityId || !facilityName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const offerSource = source ?? "facility_hero";

  if (RETIRED_FREE_WATCH_SOURCES.has(offerSource) || !ONE_TIME_EMAIL_SOURCES.has(offerSource)) {
    return NextResponse.json(
      {
        error:
          "Free Facility Watch signup is no longer available. Use Facility Watch Premium on the facility page.",
      },
      { status: 410 },
    );
  }

  // Sanitise intent to the three known values
  const safeIntent =
    intent === "research" || intent === "touring" || intent === "resident"
      ? intent
      : undefined;

  const journeyStage =
    safeIntent === "resident"
      ? "resident"
      : safeIntent === "touring"
        ? "decision"
        : "search";
  const normalizedEmail = email.trim().toLowerCase();

  const userGroup: string =
    offerSource === "offer_records"
      ? "offer_records"
      : offerSource === "offer_tour"
        ? "offer_tour"
        : "facility_watch";

  const supabase = getServiceClient();
  const confirmedAt = new Date().toISOString();

  // One-time leads are not eligible for ongoing official-record alert dispatch.
  const { data, error } = await supabase
    .from("facility_watchers")
    .upsert(
      {
        email: normalizedEmail,
        facility_id: facilityId,
        source: offerSource,
        confirmed_at: confirmedAt,
        baseline_at: confirmedAt,
        last_successful_scan_at: null,
        alerts_eligible: false,
        ...(safeIntent ? { intent: safeIntent } : {}),
      },
      { onConflict: "email,facility_id", ignoreDuplicates: false },
    )
    .select("unsubscribe_token")
    .single();

  if (error) {
    console.error("[watch] insert error:", error.message);
    return NextResponse.json({ error: "Could not save watch" }, { status: 500 });
  }

  try {
    const digest = await buildWatchWelcomeDigest(facilityId, data.unsubscribe_token);

    if (offerSource === "offer_records" || offerSource === "records_pull_interest") {
      await sendRecordsEmail({
        to: normalizedEmail,
        digest,
        unsubscribeToken: data.unsubscribe_token,
      });
    } else if (offerSource === "offer_tour") {
      const tourDigest = await buildTourEmailDigest(facilityId, data.unsubscribe_token);
      if (tourDigest) {
        await sendTourEmail({
          to: normalizedEmail,
          digest: tourDigest,
          unsubscribeToken: data.unsubscribe_token,
        });
      } else {
        await sendWatchWelcome({
          to: normalizedEmail,
          facilityName,
          unsubscribeToken: data.unsubscribe_token,
          digest,
        });
      }
    } else {
      // report_waitlist and similar one-time captures
      await sendWatchWelcome({
        to: normalizedEmail,
        facilityName,
        unsubscribeToken: data.unsubscribe_token,
        digest,
      });
    }
  } catch (emailErr) {
    console.error("[watch] email error:", emailErr);
  }

  await addLoopsContact({
    email: normalizedEmail,
    userGroup,
    source: offerSource,
    facilityName,
    facilityId: facilityId,
    journeyStage,
    ...(safeIntent ? { watchIntent: safeIntent } : {}),
  });

  recordSubmission({
    type: "facility_watch",
    email: normalizedEmail,
    source: offerSource,
    facilityId,
    summary: `${facilityName} · ${offerSource}${safeIntent ? ` · ${safeIntent}` : ""}`,
    payload: {
      facilityName,
      facilityId,
      alertsEligible: false,
      ...(safeIntent ? { intent: safeIntent } : {}),
    },
  }).catch((err) => console.error("[watch] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
