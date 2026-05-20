import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";

export async function POST(request: NextRequest) {
  try {
    // Audit M1 — replaced in-process Map (per-lambda; ineffective on Vercel)
    // with the shared Upstash-backed limiter used by every PII form.
    const limit = await rateLimit(`listing-report:${clientIp(request)}`, 3, 15 * 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();

    if (looksLikeBot(body?.[HONEYPOT_FIELD], body?.[HONEYPOT_TS_FIELD])) {
      return NextResponse.json({ success: true });
    }

    const { facilityId, reason, contactEmail } = body;

    // Validation
    if (!facilityId || !reason) {
      return NextResponse.json(
        { error: "Facility ID and reason are required" },
        { status: 400 }
      );
    }

    if (typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide a more detailed description (at least 10 characters)" },
        { status: 400 }
      );
    }

    if (reason.trim().length > 1000) {
      return NextResponse.json(
        { error: "Description is too long (maximum 1000 characters)" },
        { status: 400 }
      );
    }

    if (contactEmail && (typeof contactEmail !== "string" || contactEmail.length > 255)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Verify facility exists and get current status
    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .select("id, name, mc_review_status")
      .eq("id", facilityId)
      .single();

    if (facilityError || !facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    // Insert the listing report
    const userAgent = request.headers.get("user-agent") || null;
    
    const { data: report, error: reportError } = await supabase
      .from("mc_listing_reports")
      .insert({
        facility_id: facilityId,
        reason: reason.trim(),
        contact_email: contactEmail?.trim() || null,
        user_agent: userAgent,
        status: "open",
      })
      .select("id")
      .single();

    if (reportError) {
      console.error("Failed to create listing report:", reportError);
      return NextResponse.json(
        { error: "Failed to submit report" },
        { status: 500 }
      );
    }

    // If the facility is currently auto_published, move it to needs_review
    if (facility.mc_review_status === "auto_published") {
      const { error: statusError } = await supabase
        .from("facilities")
        .update({
          mc_review_status: "needs_review",
        })
        .eq("id", facilityId);

      if (statusError) {
        console.error("Failed to update facility status:", statusError);
        // Don't fail the request - the report was still created
      }

      // Add audit trail entry
      const { error: auditError } = await supabase
        .from("mc_review_audit")
        .insert({
          facility_id: facilityId,
          from_status: "auto_published",
          to_status: "needs_review",
          reviewer: "public_report",
          notes: `Public report submitted: ${reason.substring(0, 100)}${reason.length > 100 ? "..." : ""}`,
        });

      if (auditError) {
        console.error("Failed to create audit entry:", auditError);
        // Continue anyway
      }
    }

    // Admin alert + audit log — fire-and-forget, never blocks user response.
    recordSubmission({
      type: "listing_report",
      email: contactEmail?.trim() || "(not provided)",
      facilityId,
      summary: `${facility.name} · listing report`,
      payload: {
        reason: reason.trim(),
        reportId: report.id,
        contactEmail: contactEmail?.trim() || null,
      },
    }).catch((err) => console.error("[listing-report] recordSubmission failed:", err));

    return NextResponse.json({ 
      success: true, 
      reportId: report.id 
    });

  } catch (error) {
    console.error("Listing report error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}