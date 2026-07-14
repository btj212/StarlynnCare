import { NextRequest, NextResponse } from "next/server";
import { addLoopsContact } from "@/lib/loops";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { isValidEmail } from "@/lib/security/email";
import { getServiceClient } from "@/lib/supabase/server";
import { stateFromCode } from "@/lib/states";

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
    stateCode?: string;
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

  const { email, areaName, areaSlug, stateCode, source } = body;

  if (!email || !areaName || !areaSlug || !stateCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const state = stateFromCode(stateCode);
  if (!state) {
    return NextResponse.json({ error: "Unsupported state" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const safeSource = source === "state_modal" ? "state_modal" : "city_modal";
  const baselineAt = new Date().toISOString();
  const supabase = getServiceClient();
  const { error: watchError } = await supabase
    .from("area_watchers")
    .upsert(
      {
        email: normalizedEmail,
        area_name: areaName,
        area_slug: areaSlug,
        state_code: state.code,
        source: safeSource,
        active: true,
        baseline_at: baselineAt,
        last_successful_scan_at: null,
      },
      { onConflict: "email,state_code,area_slug", ignoreDuplicates: false },
    );

  if (watchError) {
    console.error("[watch/area] insert error:", watchError.message);
    return NextResponse.json({ error: "Could not save watch" }, { status: 500 });
  }

  await addLoopsContact({
    email: normalizedEmail,
    userGroup: "area_watch",
    source: safeSource,
    areaName,
    areaSlug,
    stateCode: state.code,
    journeyStage: "search",
  });

  // Admin alert + audit log — fire-and-forget, never blocks user response.
  recordSubmission({
    type: "area_watch",
    email: normalizedEmail,
    source: safeSource,
    summary: `${areaName} · ${safeSource}`,
    payload: { areaName, areaSlug, stateCode: state.code },
  }).catch((err) => console.error("[watch/area] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
