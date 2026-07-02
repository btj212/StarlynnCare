import { NextRequest, NextResponse } from "next/server";
import { addLoopsContact } from "@/lib/loops";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { sendMagnetEmail } from "@/lib/email/watch";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`watch-digest:${clientIp(req)}`, 5, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    source?: string;
    stateCode?: string;
    journeyStage?: string;
    magnet?: string;
    [HONEYPOT_FIELD]?: unknown;
    [HONEYPOT_TS_FIELD]?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (looksLikeBot(body[HONEYPOT_FIELD], body[HONEYPOT_TS_FIELD])) {
    return NextResponse.json({ ok: true });
  }

  const { email, source, stateCode, journeyStage, magnet } = body;

  if (!email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  await addLoopsContact({
    email,
    userGroup: "digest_subscriber",
    source: source ?? "mobile_digest_bar",
    journeyStage: journeyStage ?? "orientation",
    ...(stateCode ? { stateCode } : {}),
    ...(magnet ? { magnet } : {}),
  });

  // Send magnet-specific transactional email when a checklist/guide was promised.
  // Falls back silently when LOOPS_MAGNET_* env var is not yet set.
  if (magnet) {
    sendMagnetEmail({ to: email, magnet }).catch((err) =>
      console.error("[watch/digest] sendMagnetEmail failed:", err),
    );
  }

  recordSubmission({
    type: "digest_subscriber",
    email,
    source: source ?? "mobile_digest_bar",
    summary: magnet
      ? `magnet · ${magnet}`
      : stateCode
        ? `digest · ${stateCode}`
        : `digest · ${journeyStage ?? "orientation"}`,
    payload: { stateCode: stateCode ?? null, journeyStage: journeyStage ?? "orientation", magnet: magnet ?? null },
  }).catch((err) => console.error("[watch/digest] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
