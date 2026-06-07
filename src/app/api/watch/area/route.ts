import { NextRequest, NextResponse } from "next/server";
import { addLoopsContact } from "@/lib/loops";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`watch-area:${clientIp(req)}`, 5, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    areaName?: string;
    areaSlug?: string;
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

  const { email, areaName, areaSlug, source } = body;

  if (!email || !areaName || !areaSlug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  await addLoopsContact({
    email,
    userGroup: "area_watch",
    source: source ?? "city_modal",
    areaName,
    areaSlug,
  });

  // Admin alert + audit log — fire-and-forget, never blocks user response.
  recordSubmission({
    type: "area_watch",
    email,
    source: source ?? "city_modal",
    summary: `${areaName} · ${source ?? "city_modal"}`,
    payload: { areaName, areaSlug },
  }).catch((err) => console.error("[watch/area] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
