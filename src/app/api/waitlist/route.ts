import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/waitlist";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimit(`waitlist:${clientIp(req)}`, 5, 10 * 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();

    if (looksLikeBot(body?.[HONEYPOT_FIELD], body?.[HONEYPOT_TS_FIELD])) {
      return NextResponse.json({ ok: true });
    }

    const { email, zip, path } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    await addToWaitlist({
      email: email.toLowerCase().trim(),
      zip: zip?.trim() || undefined,
      path: path || "footer",
      createdAt: new Date().toISOString(),
    });

    // Admin alert + audit log — fire-and-forget, never blocks user response.
    recordSubmission({
      type: "waitlist",
      email: email.toLowerCase().trim(),
      source: path || "footer",
      summary: `Waitlist · ${zip?.trim() || "no zip"} · ${path || "footer"}`,
      payload: { zip: zip?.trim() || null, path: path || "footer" },
    }).catch((err) => console.error("[waitlist] recordSubmission failed:", err));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
