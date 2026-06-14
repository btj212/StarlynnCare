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

  // Map offer sources to their Loops userGroup for clean segmentation
  const offerSource = source ?? "facility_hero";
  const userGroup: string =
    offerSource === "offer_watch"
      ? "offer_watch"
      : offerSource === "offer_records"
        ? "offer_records"
        : offerSource === "offer_tour"
          ? "offer_tour"
          : "facility_watch";

  const supabase = getServiceClient();

  const confirmedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("facility_watchers")
    .upsert(
      {
        email,
        facility_id: facilityId,
        source: source ?? "facility_hero",
        confirmed_at: confirmedAt,
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

    if (offerSource === "offer_records") {
      await sendRecordsEmail({
        to: email,
        digest,
        unsubscribeToken: data.unsubscribe_token,
      });
    } else if (offerSource === "offer_tour") {
      const tourDigest = await buildTourEmailDigest(facilityId, data.unsubscribe_token);
      if (tourDigest) {
        await sendTourEmail({
          to: email,
          digest: tourDigest,
          unsubscribeToken: data.unsubscribe_token,
        });
      } else {
        // Fallback to watch welcome if tour data unavailable
        await sendWatchWelcome({
          to: email,
          facilityName,
          unsubscribeToken: data.unsubscribe_token,
          digest,
        });
      }
    } else {
      // offer_watch and all other sources (facility_hero, sticky_bar, etc.)
      await sendWatchWelcome({
        to: email,
        facilityName,
        unsubscribeToken: data.unsubscribe_token,
        digest,
      });
    }
  } catch (emailErr) {
    console.error("[watch] email error:", emailErr);
    // Row is saved; email can be retried
  }

  // Mirror to Loops audience — offer variants get their own userGroup for automation targeting
  await addLoopsContact({
    email,
    userGroup,
    source: offerSource,
    facilityName,
    facilityId: facilityId,
    journeyStage,
    ...(safeIntent ? { watchIntent: safeIntent } : {}),
  });

  // Admin alert + audit log — fire-and-forget, never blocks user response.
  recordSubmission({
    type: "facility_watch",
    email,
    source: offerSource,
    facilityId,
    summary: `${facilityName} · ${offerSource}`,
    payload: { facilityName, facilityId, ...(safeIntent ? { intent: safeIntent } : {}) },
  }).catch((err) => console.error("[watch] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
