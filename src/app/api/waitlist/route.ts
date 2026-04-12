import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/waitlist";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
