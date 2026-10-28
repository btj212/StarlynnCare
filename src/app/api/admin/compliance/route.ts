import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUserIsAdmin } from "@/lib/admin/auth";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { facilityId?: string; action?: string };
  if (!body.facilityId || (body.action !== "approve" && body.action !== "hold")) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const reviewStatus = body.action === "approve" ? "approved" : "held";
  const { error } = await supabase
    .from("facility_compliance_flags")
    .update({
      review_status: reviewStatus,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("facility_id", body.facilityId)
    .eq("tier", 1);

  if (error) {
    console.error("Failed to update compliance flag:", error);
    return NextResponse.json({ error: "Failed to update flag" }, { status: 500 });
  }

  const { data: facility } = await supabase
    .from("facilities")
    .select("state_code, wa_facility_type, license_status, serves_memory_care, mc_review_status")
    .eq("id", body.facilityId)
    .maybeSingle();

  if (
    facility?.state_code === "WA" &&
    facility.wa_facility_type === "AFH"
  ) {
    const publishable =
      body.action === "approve" &&
      facility.license_status === "LICENSED" &&
      facility.serves_memory_care === true &&
      facility.mc_review_status !== "reviewed_reject";
    await supabase
      .from("facilities")
      .update({ publishable, state_records_checked_at: new Date().toISOString() })
      .eq("id", body.facilityId);
  }

  return NextResponse.json({ success: true });
}
