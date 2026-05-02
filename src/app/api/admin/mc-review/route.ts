import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUserIsAdmin } from "@/lib/admin/auth";

type ReviewAction = "approve" | "reject" | "pending" | "restore" | "approve_anyway";

const ACTIONS: ReviewAction[] = ["approve", "reject", "pending", "restore", "approve_anyway"];

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await currentUserIsAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { facilityId, action, notes } = body as {
      facilityId?: string;
      action?: ReviewAction;
      notes?: string;
    };

    if (!facilityId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: currentFacility, error: fetchError } = await supabase
      .from("facilities")
      .select(
        "id, license_status, mc_signal_explicit_name, memory_care_disclosure_filed, mc_signal_chain_curated, mc_review_status, mc_review_notes",
      )
      .eq("id", facilityId)
      .single();

    if (fetchError || !currentFacility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const today = new Date().toISOString().split("T")[0];
    const stamp = (label: string) =>
      `[${today}] ${label}.${notes ? ` ${notes.trim()}` : ""}`.trim();

    let newStatus: string;
    let finalNotes: string | null = null;

    switch (action) {
      case "approve":
        newStatus = "reviewed_publish";
        finalNotes = notes?.trim() || null;
        break;
      case "reject":
        newStatus = "reviewed_reject";
        finalNotes = notes?.trim() || null;
        break;
      case "pending":
        newStatus = "needs_review";
        finalNotes = notes?.trim() || currentFacility.mc_review_notes;
        break;
      case "restore": {
        newStatus = "needs_review";
        const existing = currentFacility.mc_review_notes || "";
        finalNotes = (existing ? existing + "\n\n" : "") + stamp("Restored to queue");
        break;
      }
      case "approve_anyway": {
        newStatus = "reviewed_publish";
        const existing = currentFacility.mc_review_notes || "";
        finalNotes = (existing ? existing + "\n\n" : "") + stamp("Approved anyway");
        break;
      }
    }

    const { error: facilityUpdateError } = await supabase
      .from("facilities")
      .update({
        mc_review_status: newStatus,
        mc_review_notes: finalNotes,
        mc_reviewed_by: userId,
        mc_reviewed_at: new Date().toISOString(),
      })
      .eq("id", facilityId);

    if (facilityUpdateError) {
      console.error("Failed to update facility:", facilityUpdateError);
      return NextResponse.json({ error: "Failed to update facility" }, { status: 500 });
    }

    const { error: auditError } = await supabase.from("mc_review_audit").insert({
      facility_id: facilityId,
      from_status: currentFacility.mc_review_status,
      to_status: newStatus,
      reviewer: userId,
      notes: notes?.trim() || null,
    });

    if (auditError) {
      // Audit failure shouldn't block the main action
      console.error("Failed to write audit row:", auditError);
    }

    const servesMC =
      currentFacility.mc_signal_explicit_name ||
      currentFacility.memory_care_disclosure_filed ||
      currentFacility.mc_signal_chain_curated ||
      newStatus === "reviewed_publish";

    const publishable =
      currentFacility.license_status === "LICENSED" &&
      servesMC &&
      newStatus !== "reviewed_reject";

    const { error: flagsError } = await supabase
      .from("facilities")
      .update({ serves_memory_care: servesMC, publishable })
      .eq("id", facilityId);

    if (flagsError) {
      console.error("Failed to recompute flags:", flagsError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin review action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
