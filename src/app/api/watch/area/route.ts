import { NextRequest, NextResponse } from "next/server";
import { addLoopsContact } from "@/lib/loops";

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

  await addLoopsContact({
    email,
    userGroup: "area_watch",
    source: source ?? "city_modal",
    areaName,
    areaSlug,
  });

  return NextResponse.json({ ok: true });
}
