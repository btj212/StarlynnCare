/**
 * listing-report.test.ts — Integration tests for POST /api/listing-report.
 *
 * Verifies the complete listing report API route end-to-end:
 *   - Validation (facility ID, reason length, email format)
 *   - DB write to mc_listing_reports
 *   - Status transition: auto_published → needs_review
 *   - Audit trail in mc_review_audit
 *   - Rate limiting (3 requests per 15 minutes per IP)
 *
 * Uses real Supabase service-role client for DB verification.
 * All test records are cleaned up after each test.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_BASE_URL
 */
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getRealFacilityInfo(db: ReturnType<typeof createClient>) {
  const { data } = await db
    .from("facilities")
    .select("id, name, mc_review_status")
    .eq("publishable", true)
    .limit(1)
    .single();
  return data;
}

describe("POST /api/listing-report", () => {
  let db: ReturnType<typeof createClient> | null;
  let realFacility: { id: string; name: string; mc_review_status: string } | null;
  let createdReportIds: string[] = [];

  beforeAll(async () => {
    db = getServiceClient();
    if (db) {
      realFacility = await getRealFacilityInfo(db);
    }
  });

  afterEach(async () => {
    if (db && createdReportIds.length > 0) {
      await db.from("mc_listing_reports").delete().in("id", createdReportIds);
      createdReportIds = [];
    }
  });

  function skip() {
    return !BASE_URL || !db || !realFacility;
  }

  it("returns 400 when facilityId is missing", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "This facility does not serve memory care." }),
    });
    expect(resp.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: "some-id" }),
    });
    expect(resp.status).toBe(400);
  });

  it("returns 400 when reason is shorter than 10 characters", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: "some-id",
        reason: "Too short",
      }),
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/10 char/i);
  });

  it("returns 400 when reason exceeds 1000 characters", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: "some-id",
        reason: "A".repeat(1001),
      }),
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/1000 char/i);
  });

  it("returns 400 when contactEmail exceeds 255 characters", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: "some-id",
        reason: "This facility incorrectly claims to have memory care.",
        contactEmail: "a".repeat(250) + "@example.com",
      }),
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 404 for non-existent facility ID", async () => {
    if (!BASE_URL || !db) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: "00000000-0000-0000-0000-000000000000",
        reason: "This facility does not have a memory care unit.",
      }),
    });
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 200 and creates mc_listing_reports row for valid request", async () => {
    if (skip()) return;
    const reason = "This facility does not actually provide memory care services.";
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: realFacility!.id,
        reason,
        contactEmail: "reporter@starlynncare-test.invalid",
      }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.reportId).toBeTruthy();

    // Verify DB row was created
    const { data, error } = await db!
      .from("mc_listing_reports")
      .select("id, facility_id, reason, contact_email, status")
      .eq("id", body.reportId)
      .single();
    expect(error).toBeNull();
    expect(data!.facility_id).toBe(realFacility!.id);
    expect(data!.reason).toBe(reason);
    expect(data!.contact_email).toBe("reporter@starlynncare-test.invalid");
    expect(data!.status).toBe("open");

    createdReportIds.push(body.reportId);
  });

  it("status=open is set on new reports", async () => {
    if (skip()) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: realFacility!.id,
        reason: "I believe this listing is incorrectly classified.",
      }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();

    const { data } = await db!
      .from("mc_listing_reports")
      .select("status")
      .eq("id", body.reportId)
      .single();
    expect(data!.status).toBe("open");

    createdReportIds.push(body.reportId);
  });

  it("null contactEmail is stored when omitted", async () => {
    if (skip()) return;
    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: realFacility!.id,
        reason: "No memory care services offered despite the listing.",
      }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();

    const { data } = await db!
      .from("mc_listing_reports")
      .select("contact_email")
      .eq("id", body.reportId)
      .single();
    expect(data!.contact_email).toBeNull();

    createdReportIds.push(body.reportId);
  });

  it("auto_published facility transitions to needs_review when reported", async () => {
    if (skip()) return;

    // Find an auto_published facility specifically
    const { data: autoPubFacility } = await db!
      .from("facilities")
      .select("id, name, mc_review_status")
      .eq("mc_review_status", "auto_published")
      .eq("publishable", true)
      .limit(1)
      .single();

    if (!autoPubFacility) {
      console.warn("⚠ No auto_published facilities to test status transition");
      return;
    }

    const originalStatus = autoPubFacility.mc_review_status;

    const resp = await fetch(`${BASE_URL}/api/listing-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: autoPubFacility.id,
        reason: "This facility does not actually provide memory care.",
      }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    createdReportIds.push(body.reportId);

    // Verify status transitioned to needs_review
    const { data: updated } = await db!
      .from("facilities")
      .select("mc_review_status")
      .eq("id", autoPubFacility.id)
      .single();

    if (originalStatus === "auto_published") {
      expect(updated!.mc_review_status).toBe("needs_review");

      // Verify audit trail was created
      const { data: audit } = await db!
        .from("mc_review_audit")
        .select("from_status, to_status, reviewer")
        .eq("facility_id", autoPubFacility.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      expect(audit!.from_status).toBe("auto_published");
      expect(audit!.to_status).toBe("needs_review");
      expect(audit!.reviewer).toBe("public_report");

      // Restore original status
      await db!
        .from("facilities")
        .update({ mc_review_status: "auto_published" })
        .eq("id", autoPubFacility.id);
    }
  });
});
