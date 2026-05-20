import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { sendWatchConfirmation } from "@/lib/email/watch";
import { addLoopsContact } from "@/lib/loops";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";

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

  const { email, facilityId, facilityName, source } = body;

  if (!email || !facilityId || !facilityName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("facility_watchers")
    .upsert(
      { email, facility_id: facilityId, source: source ?? "facility_hero" },
      { onConflict: "email,facility_id", ignoreDuplicates: false },
    )
    .select("confirmation_token")
    .single();

  if (error) {
    console.error("[watch] insert error:", error.message);
    return NextResponse.json({ error: "Could not save watch" }, { status: 500 });
  }

  try {
    await sendWatchConfirmation({
      to: email,
      facilityName,
      confirmationToken: data.confirmation_token,
    });
  } catch (emailErr) {
    console.error("[watch] email error:", emailErr);
    // Row is saved; email can be retried
  }

  // Mirror to Loops audience so all sign-ups are visible in one place
  await addLoopsContact({
    email,
    userGroup: "facility_watch",
    source: source ?? "facility_hero",
    facilityName,
    facilityId: facilityId,
  });

  // Admin alert + audit log — fire-and-forget, never blocks user response.
  recordSubmission({
    type: "facility_watch",
    email,
    source: source ?? "facility_hero",
    facilityId,
    summary: `${facilityName} · ${source ?? "facility_hero"}`,
    payload: { facilityName, facilityId },
  }).catch((err) => console.error("[watch] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
