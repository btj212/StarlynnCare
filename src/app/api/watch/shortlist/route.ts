import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { registerCustomerCommitment } from "@/lib/customers/commitments";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";

type ShortlistFacility = {
  id: string;
  name: string;
};

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`watch-shortlist:${clientIp(req)}`, 3, 15 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    facilities?: ShortlistFacility[];
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

  const { email, facilities, source } = body;

  if (!email || !Array.isArray(facilities) || facilities.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const validFacilities = facilities
    .filter((f): f is ShortlistFacility => typeof f?.id === "string" && typeof f?.name === "string")
    .slice(0, 10);

  if (validFacilities.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const facilityNames = validFacilities.map((f) => f.name).join(", ");
  const subjectKey = createHash("sha256")
    .update(validFacilities.map((f) => f.id).sort().join(","))
    .digest("hex")
    .slice(0, 16);

  await registerCustomerCommitment({
    email: normalizedEmail,
    product: "shortlist_report",
    subjectKey,
    source: source ?? "shortlist_page",
    status: "open",
    stage: "asset_pending",
    dueAt: new Date().toISOString(),
    metadata: { facilities: validFacilities },
    contact: {
      email: normalizedEmail,
      userGroup: "shortlist",
      source: source ?? "shortlist_page",
      journeyStage: "decision",
      shortlistCount: String(validFacilities.length),
      shortlistFacilities: facilityNames.slice(0, 500),
    },
  });

  recordSubmission({
    type: "shortlist_watch",
    email: normalizedEmail,
    source: source ?? "shortlist_page",
    summary: `${validFacilities.length} facilities · ${facilityNames.slice(0, 120)}`,
    payload: {
      facilities: validFacilities,
      promise: "One-time comparison report. Not an ongoing inspection alert.",
    },
  }).catch((err) => console.error("[watch/shortlist] recordSubmission failed:", err));

  return NextResponse.json({ ok: true, delivered: false });
}
