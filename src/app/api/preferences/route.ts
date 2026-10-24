import { NextRequest, NextResponse } from "next/server";
import { isJourneyStage, setJourneyStage, updateCustomerPreference } from "@/lib/customers/commitments";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`preferences:${clientIp(req)}`, 20, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: { token?: string; action?: string; commitmentId?: string; stage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "set_stage") {
    if (!body.stage || !isJourneyStage(body.stage)) {
      return NextResponse.json({ error: "Choose where you are in the decision." }, { status: 400 });
    }
    const stageResult = await setJourneyStage({ token: body.token ?? "", stage: body.stage });
    if (!stageResult.ok) {
      return NextResponse.json({ error: stageResult.error ?? "Could not update." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (
    body.action !== "unsubscribe" &&
    body.action !== "resubscribe" &&
    body.action !== "unsubscribe_all"
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await updateCustomerPreference({
    token: body.token ?? "",
    action: body.action,
    commitmentId: body.commitmentId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not update." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, billingSeparate: result.billingSeparate ?? false });
}
