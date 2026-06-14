import { NextRequest, NextResponse } from "next/server";
import { addLoopsContact } from "@/lib/loops";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { sendContractAck } from "@/lib/email/contract";
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

  // Send acknowledgment email — tells user to reply with their PDF
  try {
    await sendContractAck({ to: email });
  } catch (emailErr) {
    console.error("[offer/contract] email error:", emailErr);
    // Continue — submission recorded even if email fails
  }

  // Add to Loops with offer_contract userGroup for automation targeting
  await addLoopsContact({
    email,
    userGroup: "offer_contract",
    source: offerSource,
    journeyStage: "decision",
  });

  // Admin audit log
  recordSubmission({
    type: "contract_review",
    email,
    source: offerSource,
    summary: `Contract review request · ${offerSource}`,
    payload: { source: offerSource },
  }).catch((err) => console.error("[offer/contract] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
