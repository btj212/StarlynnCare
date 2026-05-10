import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { email?: string; areaName?: string; areaSlug?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, areaName, areaSlug, source } = body;

  if (!email || !areaName || !areaSlug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.error("[watch/area] LOOPS_API_KEY not set — skipping contact creation");
    return NextResponse.json({ ok: true });
  }

  const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      userGroup: "area_watch",
      source: source ?? "city_modal",
      areaName,
      areaSlug,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // 409 = contact already exists — treat as success
    if (res.status !== 409) {
      console.error("[watch/area] Loops error", res.status, text);
      return NextResponse.json({ error: "Could not register interest" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
