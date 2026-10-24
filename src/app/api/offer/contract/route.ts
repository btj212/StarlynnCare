import { NextRequest, NextResponse } from "next/server";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { sendContractAck } from "@/lib/email/contract";
import {
  commitmentIdempotencyKey,
  preferenceUrl,
  recordCustomerDelivery,
  registerCustomerCommitment,
} from "@/lib/customers/commitments";
import { addBusinessDays, requestWindowKey } from "@/lib/customers/sla";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`offer-contract:${clientIp(req)}`, 3, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    source?: string;
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

  const { email, source } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const offerSource = source ?? "contract_review_page";
  const normalizedEmail = email.trim().toLowerCase();
  const dueAt = addBusinessDays(new Date(), 2).toISOString();

  const registered = await registerCustomerCommitment({
    email: normalizedEmail,
    product: "contract_review",
    subjectKey: "admission-agreement",
    source: offerSource,
    status: "open",
    stage: "requested",
    dueAt,
    contact: {
      email: normalizedEmail,
      userGroup: "offer_contract",
      source: offerSource,
      journeyStage: "decision",
    },
  });

  const sent = await sendContractAck({
    to: normalizedEmail,
    preferenceUrl: preferenceUrl(registered.preferenceToken),
  });

  await recordCustomerDelivery({
    commitmentId: registered.commitmentId,
    idempotencyKey: commitmentIdempotencyKey([
      "ack",
      normalizedEmail,
      requestWindowKey(),
    ]),
    kind: "confirmation",
    status: sent ? "sent" : "failed",
    templateKey: "contract_ack",
    error: sent ? undefined : "ack_not_sent",
  });

  recordSubmission({
    type: "contract_review",
    email: normalizedEmail,
    source: offerSource,
    summary: `Contract review request · ${offerSource}`,
    payload: { source: offerSource, stage: "requested", dueAt },
  }).catch((err) => console.error("[offer/contract] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
