/**
 * 08 — Listing Report API: Full E2E Test
 *
 * Calls the POST /api/listing-report route handler directly (no HTTP server
 * needed — we import and invoke it), then verifies:
 *   • The report row is inserted with all correct fields
 *   • A facility with mc_review_status=auto_published is moved to needs_review
 *   • An audit row is created in mc_review_audit
 *   • All validation error cases return the correct HTTP status
 *   • Rate limiting kicks in after RATE_LIMIT_MAX_REQUESTS calls
 *
 * Each test that writes data cleans up after itself.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { serviceRoleClient, isServiceUnconfigured } from "../helpers/client";
import { POST } from "@/app/api/listing-report/route";

const SKIP = isServiceUnconfigured();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A real, publishable facility ID used for happy-path tests. */
let facilityId: string;
/** IDs of test reports inserted during this run, for cleanup. */
const insertedReportIds: string[] = [];

function makeRequest(
  body: Record<string, unknown>,
  overrides: { ip?: string } = {},
): NextRequest {
  return new NextRequest("http://localhost/api/listing-report", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      // Use a unique IP per request so rate-limit tests don't bleed into each other.
      "x-forwarded-for": overrides.ip ?? `192.0.2.${Math.floor(Math.random() * 200) + 50}`,
      "user-agent": "StarlynnCare-Integration-Test/1.0",
    },
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (SKIP) return;
  const { data } = await serviceRoleClient()
    .from("facilities")
    .select("id, mc_review_status")
    .eq("publishable", true)
    .limit(1)
    .single();
  facilityId = (data as { id: string }).id;
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  if (SKIP) return;
  if (insertedReportIds.length > 0) {
    await serviceRoleClient()
      .from("mc_listing_reports")
      .delete()
      .in("id", insertedReportIds);
  }
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("08 · listing-report API — happy path", () => {
  let reportId: string;

  it.skipIf(SKIP)("POST with valid body returns 200 and a reportId", async () => {
    const req = makeRequest({
      facilityId,
      reason: "The memory care information appears to be inaccurate for this facility.",
      contactEmail: "reporter@example.com",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; reportId: string };
    expect(json.success).toBe(true);
    expect(typeof json.reportId).toBe("string");
    expect(json.reportId).toMatch(/^[0-9a-f-]{36}$/);
    reportId = json.reportId;
    insertedReportIds.push(reportId);
  });

  it.skipIf(SKIP)("the report row exists in mc_listing_reports with all fields", async () => {
    if (!reportId) return;
    const { data } = await serviceRoleClient()
      .from("mc_listing_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    expect(data).not.toBeNull();
    const row = data as Record<string, unknown>;

    expect(row.id).toBe(reportId);
    expect(row.facility_id).toBe(facilityId);
    expect(row.reason).toBe(
      "The memory care information appears to be inaccurate for this facility.",
    );
    expect(row.contact_email).toBe("reporter@example.com");
    expect(row.user_agent).toContain("StarlynnCare-Integration-Test");
    expect(row.status).toBe("open");
    expect(new Date(row.created_at as string).getTime()).not.toBeNaN();
    expect(row.resolved_at).toBeNull();
    expect(row.resolved_by).toBeNull();
  });
});

// ─── Status transition for auto_published facilities ──────────────────────────

describe("08 · listing-report API — auto_published → needs_review transition", () => {
  let autoPublishedFacilityId: string;
  const cleanupReportIds: string[] = [];

  beforeAll(async () => {
    if (SKIP) return;
    // Find or create a facility with mc_review_status=auto_published
    const { data } = await serviceRoleClient()
      .from("facilities")
      .select("id, mc_review_status")
      .eq("publishable", true)
      .eq("mc_review_status", "auto_published")
      .limit(1)
      .maybeSingle();

    if (!data) return; // no auto_published facility — tests skip gracefully
    autoPublishedFacilityId = (data as { id: string }).id;
  });

  afterAll(async () => {
    if (SKIP) return;
    if (cleanupReportIds.length > 0) {
      await serviceRoleClient()
        .from("mc_listing_reports")
        .delete()
        .in("id", cleanupReportIds);
    }
    // Restore the facility's mc_review_status to auto_published
    if (autoPublishedFacilityId) {
      await serviceRoleClient()
        .from("facilities")
        .update({ mc_review_status: "auto_published" })
        .eq("id", autoPublishedFacilityId);
      // Clean up any audit rows we created
      await serviceRoleClient()
        .from("mc_review_audit")
        .delete()
        .eq("facility_id", autoPublishedFacilityId)
        .eq("reviewer", "public_report");
    }
  });

  it.skipIf(SKIP)("reporting an auto_published facility moves it to needs_review", async () => {
    if (!autoPublishedFacilityId) return;

    const req = makeRequest({
      facilityId: autoPublishedFacilityId,
      reason: "Integration test: verifying status transition from auto_published to needs_review.",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { reportId: string };
    cleanupReportIds.push(json.reportId);

    const { data } = await serviceRoleClient()
      .from("facilities")
      .select("mc_review_status")
      .eq("id", autoPublishedFacilityId)
      .single();

    expect((data as { mc_review_status: string }).mc_review_status).toBe("needs_review");
  });

  it.skipIf(SKIP)("an audit row is created in mc_review_audit", async () => {
    if (!autoPublishedFacilityId) return;

    const { data } = await serviceRoleClient()
      .from("mc_review_audit")
      .select("*")
      .eq("facility_id", autoPublishedFacilityId)
      .eq("reviewer", "public_report")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(data).not.toBeNull();
    const row = data as Record<string, unknown>;
    expect(row.from_status).toBe("auto_published");
    expect(row.to_status).toBe("needs_review");
    expect(row.reviewer).toBe("public_report");
    expect(typeof row.notes).toBe("string");
    expect(new Date(row.created_at as string).getTime()).not.toBeNaN();
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe("08 · listing-report API — validation errors", () => {
  it.skipIf(SKIP)("missing facilityId returns 400", async () => {
    const req = makeRequest({ reason: "Some reason that is long enough." });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(typeof json.error).toBe("string");
  });

  it.skipIf(SKIP)("missing reason returns 400", async () => {
    const req = makeRequest({ facilityId });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(typeof json.error).toBe("string");
  });

  it.skipIf(SKIP)("reason shorter than 10 chars returns 400", async () => {
    const req = makeRequest({ facilityId, reason: "Short" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it.skipIf(SKIP)("reason longer than 1000 chars returns 400", async () => {
    const req = makeRequest({ facilityId, reason: "X".repeat(1001) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it.skipIf(SKIP)("contactEmail over 255 chars returns 400", async () => {
    const longEmail = `${"a".repeat(250)}@example.com`;
    const req = makeRequest({
      facilityId,
      reason: "A sufficiently long reason for testing purposes.",
      contactEmail: longEmail,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it.skipIf(SKIP)("non-existent facilityId returns 404", async () => {
    const req = makeRequest({
      facilityId: "00000000-0000-0000-0000-000000000000",
      reason: "Testing with a nonexistent facility ID.",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it.skipIf(SKIP)("report without contactEmail succeeds (optional field)", async () => {
    const req = makeRequest({
      facilityId,
      reason: "This is a valid report without a contact email address.",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { reportId: string };
    insertedReportIds.push(json.reportId);

    // Verify contact_email is null in DB
    const { data } = await serviceRoleClient()
      .from("mc_listing_reports")
      .select("contact_email")
      .eq("id", json.reportId)
      .single();
    expect((data as { contact_email: string | null }).contact_email).toBeNull();
  });
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe("08 · listing-report API — rate limiting", () => {
  it.skipIf(SKIP)(
    "4th request from the same IP within the window returns 429",
    async () => {
      // Use a dedicated static IP to test rate limiting.
      const rateLimitIp = "203.0.113.99";
      const body = {
        facilityId,
        reason: "Rate limit test reason — long enough to pass validation.",
      };

      // First three requests must succeed.
      for (let i = 0; i < 3; i++) {
        const req = makeRequest(body, { ip: rateLimitIp });
        const res = await POST(req);
        expect([200, 400, 404]).toContain(res.status); // success or validation error — not 429
        if (res.status === 200) {
          const json = await res.json() as { reportId: string };
          insertedReportIds.push(json.reportId);
        }
      }

      // Fourth request must be rate limited.
      const req4 = makeRequest(body, { ip: rateLimitIp });
      const res4 = await POST(req4);
      expect(res4.status).toBe(429);
      const json4 = await res4.json() as { error: string };
      expect(typeof json4.error).toBe("string");
    },
  );
});
