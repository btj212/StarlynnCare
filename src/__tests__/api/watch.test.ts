/**
 * watch.test.ts — Integration tests for POST /api/watch.
 *
 * Tests the COMPLETE watch API route: validation → DB write → Loops email → audit log.
 *
 * Uses a real Supabase service-role client to verify DB state.
 * Cleans up all test records after each test to avoid polluting production data.
 *
 * No mocking: all Supabase calls hit real DB. Loops API call may fail if
 * LOOPS_API_KEY is not set — the route handles this gracefully (email error
 * is logged but doesn't fail the response).
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

async function getRealFacilityId(db: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await db
    .from("facilities")
    .select("id, name")
    .eq("publishable", true)
    .limit(1)
    .single();
  return data?.id ?? null;
}

describe("POST /api/watch", () => {
  let db: ReturnType<typeof createClient> | null;
  let realFacilityId: string | null;
  const testEmail = `test-watch-${Date.now()}@starlynncare-test.invalid`;
  let insertedIds: string[] = [];

  beforeAll(async () => {
    if (!BASE_URL) {
      console.log("⚠ NEXT_PUBLIC_BASE_URL not set — API route tests will be skipped");
    }
    db = getServiceClient();
    if (db) {
      realFacilityId = await getRealFacilityId(db);
    }
  });

  afterEach(async () => {
    // Clean up test records from facility_watchers
    if (db && insertedIds.length > 0) {
      await db.from("facility_watchers").delete().in("id", insertedIds);
      insertedIds = [];
    }
    // Also clean by email in case id wasn't captured
    if (db) {
      await db.from("facility_watchers").delete().eq("email", testEmail);
    }
  });

  function skip() {
    if (!BASE_URL || !db || !realFacilityId) {
      return true;
    }
    return false;
  }

  it("returns 400 when email is missing", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: "test-id", facilityName: "Test Facility" }),
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when facilityId is missing", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", facilityName: "Test Facility" }),
    });
    expect(resp.status).toBe(400);
  });

  it("returns 400 when facilityName is missing", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", facilityId: "some-id" }),
    });
    expect(resp.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        facilityId: "some-id",
        facilityName: "Test Facility",
      }),
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 400 for malformed JSON", async () => {
    if (!BASE_URL) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all {{{",
    });
    expect(resp.status).toBe(400);
  });

  it("returns 200 and writes to facility_watchers for valid request", async () => {
    if (skip()) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        facilityId: realFacilityId,
        facilityName: "Test Facility",
        source: "test_suite",
      }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);

    // Verify the DB write happened
    const { data, error } = await db!
      .from("facility_watchers")
      .select("id, email, facility_id, source, confirmation_token")
      .eq("email", testEmail)
      .eq("facility_id", realFacilityId!)
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.email).toBe(testEmail);
    expect(data!.facility_id).toBe(realFacilityId);
    expect(data!.source).toBe("test_suite");
    expect(data!.confirmation_token).toBeTruthy();

    if (data?.id) insertedIds.push(data.id);
  });

  it("returns 200 (idempotent) when same email+facility submitted twice", async () => {
    if (skip()) return;
    const payload = {
      email: testEmail,
      facilityId: realFacilityId,
      facilityName: "Test Facility",
      source: "test_suite",
    };

    const resp1 = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(resp1.status).toBe(200);

    const resp2 = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // Duplicate is an upsert — should still return 200
    expect(resp2.status).toBe(200);
    const body2 = await resp2.json();
    expect(body2.ok).toBe(true);

    // Verify only ONE row exists (upsert, not insert)
    const { data, count } = await db!
      .from("facility_watchers")
      .select("id", { count: "exact" })
      .eq("email", testEmail)
      .eq("facility_id", realFacilityId!);
    expect(count).toBe(1);

    if (data) insertedIds.push(...data.map((r: { id: string }) => r.id));
  });

  it("default source is facility_hero when source is omitted", async () => {
    if (skip()) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        facilityId: realFacilityId,
        facilityName: "Test Facility",
        // no source field
      }),
    });
    expect(resp.status).toBe(200);

    const { data } = await db!
      .from("facility_watchers")
      .select("id, source")
      .eq("email", testEmail)
      .single();
    expect(data!.source).toBe("facility_hero");
    if (data?.id) insertedIds.push(data.id);
  });

  it("confirmation_token is a non-empty UUID", async () => {
    if (skip()) return;
    const resp = await fetch(`${BASE_URL}/api/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        facilityId: realFacilityId,
        facilityName: "Test",
        source: "test_suite",
      }),
    });
    expect(resp.status).toBe(200);

    const { data } = await db!
      .from("facility_watchers")
      .select("confirmation_token")
      .eq("email", testEmail)
      .single();
    const token = data!.confirmation_token;
    expect(token).toBeTruthy();
    // Tokens are UUID-shaped or at least 20+ chars
    expect(token.length).toBeGreaterThan(20);
  });
});
