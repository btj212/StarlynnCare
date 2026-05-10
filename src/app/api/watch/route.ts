import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { sendWatchConfirmation } from "@/lib/email/watch";

export async function POST(req: NextRequest) {
  let body: { email?: string; facilityId?: string; facilityName?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, facilityId, facilityName, source } = body;

  if (!email || !facilityId || !facilityName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("facility_watchers")
    .upsert(
      { email, facility_id: facilityId, source: source ?? "facility_hero" },
      { onConflict: "email,facility_id", ignoreDuplicates: false },
    )
    .select("confirmation_token")
    .single();

  if (error) {
    console.error("[watch] insert error:", error.message);
    return NextResponse.json({ error: "Could not save watch" }, { status: 500 });
  }

  try {
    await sendWatchConfirmation({
      to: email,
      facilityName,
      confirmationToken: data.confirmation_token,
    });
  } catch (emailErr) {
    console.error("[watch] email error:", emailErr);
    // Row is saved; email can be retried
  }

  return NextResponse.json({ ok: true });
}
