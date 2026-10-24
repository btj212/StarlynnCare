import { NextRequest, NextResponse } from "next/server";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { sendMagnetEmail } from "@/lib/email/watch";
import {
  commitmentIdempotencyKey,
  recordCustomerDelivery,
  registerCustomerCommitment,
} from "@/lib/customers/commitments";
import { addCalendarDays, requestWindowKey } from "@/lib/customers/sla";
import { readAttribution } from "@/lib/customers/attribution";
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

  if (!email || !magnet) {
    return NextResponse.json(
      { error: "Choose a guide, or watch one state from the homepage bar." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const registered = await registerCustomerCommitment({
    email: normalizedEmail,
    product: "library_magnet",
    subjectKey: magnet,
    source: source ?? "library",
    status: "open",
    stage: "asset_pending",
    dueAt: new Date().toISOString(),
    followUpDueAt: addCalendarDays(new Date(), 7).toISOString(),
    metadata: { magnet, stateCode: stateCode ?? null, ...readAttribution(body) },
    contact: {
      email: normalizedEmail,
      userGroup: "digest_subscriber",
      source: source ?? "library",
      journeyStage: journeyStage ?? "orientation",
      ...(stateCode ? { stateCode } : {}),
      magnet,
    },
  });
  const sent = await sendMagnetEmail({ to: normalizedEmail, magnet });

  await recordCustomerDelivery({
    commitmentId: registered.commitmentId,
    idempotencyKey: commitmentIdempotencyKey([
      "asset",
      magnet,
      normalizedEmail,
      requestWindowKey(),
    ]),
    kind: "asset",
    status: sent ? "sent" : "failed",
    templateKey: magnet,
    fulfills: sent,
    error: sent ? undefined : "magnet_template_not_sent",
  });

  recordSubmission({
    type: "digest_subscriber",
    email: normalizedEmail,
    source: source ?? "library",
    summary: `magnet · ${magnet}`,
    payload: { stateCode: stateCode ?? null, journeyStage: journeyStage ?? "orientation", magnet },
  }).catch((err) => console.error("[watch/digest] recordSubmission failed:", err));

  return NextResponse.json({ ok: true, delivered: sent });
}
