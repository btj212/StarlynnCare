import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

// Basic rate limiting using a simple in-memory store
// In production, this should use Redis or a proper rate limiting solution
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 3; // 3 requests per 15 minutes per IP

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = (forwarded ? forwarded.split(",")[0] : realIp) || "unknown";
  return `listing-report:${ip.trim()}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Reset or initialize
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count++;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request);
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
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