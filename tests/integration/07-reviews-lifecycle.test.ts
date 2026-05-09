/**
 * 07 — Reviews: Full Lifecycle Test
 *
 * Tests the complete review pipeline from public submission through admin
 * moderation to public visibility, then cleanup.  Every DB column on the
 * reviews table is verified.  RLS is exercised at every stage.
 *
 * Stages:
 *   1.  submitReview() Server Action → inserts "pending" row
 *   2.  Public client CANNOT read the pending review (RLS)
 *   3.  Service client CAN read the pending review
 *   4.  Service client promotes it to "published"
 *   5.  Public client CAN now read it via loadPublishedReviews()
 *   6.  All 7 rating categories + comments are stored correctly
 *   7.  Validation errors are returned for bad inputs
 *   8.  Cleanup: delete the test review
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { publicClient, serviceRoleClient, isServiceUnconfigured } from "../helpers/client";
import { submitReview } from "@/app/actions/submitReview";
import { loadPublishedReviews } from "@/lib/reviews/loadPublishedReviews";
import { REVIEW_CATEGORIES } from "@/components/reviews/categories";

const SKIP = isServiceUnconfigured();

// ─── Shared test state ────────────────────────────────────────────────────────

let testFacilityId: string;
let testReviewId: string | null = null;

/** Build a fully-populated FormData for a valid review submission. */
function makeValidFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("reviewer_name", "Integration Test User");
  fd.set("reviewer_relationship", "Family member of current resident");
  fd.set("residency_period", "2022–2024");
  fd.set("overall_summary", "This is a comprehensive integration test review with a meaningful summary.");
  fd.set("reviewer_email", "test-integration@example.com");

  for (const cat of REVIEW_CATEGORIES) {
    fd.set(`rating_${cat.key}`, "4");
    fd.set(`comment_${cat.key}`, `This is a test comment for ${cat.label} category.`);
  }

  for (const [key, val] of Object.entries(overrides)) {
    fd.set(key, val);
  }
  return fd;
}

// ─── Setup: discover a real facility ID ──────────────────────────────────────

beforeAll(async () => {
  if (SKIP) return;
  const { data } = await serviceRoleClient()
    .from("facilities")
    .select("id")
    .eq("publishable", true)
    .limit(1)
    .single();
  testFacilityId = (data as { id: string }).id;
});

// ─── Cleanup: remove test review after all tests ─────────────────────────────

afterAll(async () => {
  if (SKIP || !testReviewId) return;
  await serviceRoleClient().from("reviews").delete().eq("id", testReviewId);
});

// ─── 1. Valid submission inserts a pending review ─────────────────────────────

describe("07 · Reviews — valid submission creates a pending row", () => {
  it.skipIf(SKIP)("submitReview() returns status:success", async () => {
    const result = await submitReview(
      testFacilityId,
      { status: "idle" },
      makeValidFormData(),
    );
    expect(result.status).toBe("success");
    expect(typeof result.message).toBe("string");
    expect(result.message!.length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("the review appears in DB with status=pending", async () => {
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("*")
      .eq("facility_id", testFacilityId)
      .eq("reviewer_name", "Integration Test User")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(data).not.toBeNull();
    testReviewId = (data as { id: string }).id;
  });
});

// ─── 2. All stored fields are correct ────────────────────────────────────────

describe("07 · Reviews — all DB columns stored correctly", () => {
  it.skipIf(SKIP)("reviewer_name is stored correctly", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("reviewer_name")
      .eq("id", testReviewId)
      .single();
    expect((data as { reviewer_name: string }).reviewer_name).toBe("Integration Test User");
  });

  it.skipIf(SKIP)("reviewer_relationship is stored correctly", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("reviewer_relationship")
      .eq("id", testReviewId)
      .single();
    expect((data as { reviewer_relationship: string }).reviewer_relationship).toBe(
      "Family member of current resident",
    );
  });

  it.skipIf(SKIP)("residency_period is stored correctly", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("residency_period")
      .eq("id", testReviewId)
      .single();
    expect((data as { residency_period: string }).residency_period).toBe("2022–2024");
  });

  it.skipIf(SKIP)("overall_summary is stored correctly", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("overall_summary")
      .eq("id", testReviewId)
      .single();
    expect((data as { overall_summary: string }).overall_summary).toContain(
      "comprehensive integration test review",
    );
  });

  it.skipIf(SKIP)("reviewer_email is stored correctly", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("reviewer_email")
      .eq("id", testReviewId)
      .single();
    expect((data as { reviewer_email: string }).reviewer_email).toBe(
      "test-integration@example.com",
    );
  });

  it.skipIf(SKIP)("all 7 rating columns are stored as 4", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select(
        "rating_staff_engagement, rating_personal_care, rating_activities, rating_food, rating_transparency, rating_safety, rating_night_weekend",
      )
      .eq("id", testReviewId)
      .single();

    const row = data as Record<string, number>;
    for (const cat of REVIEW_CATEGORIES) {
      expect(row[`rating_${cat.key}`]).toBe(4);
    }
  });

  it.skipIf(SKIP)("all 7 comment columns are stored", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select(
        "comment_staff_engagement, comment_personal_care, comment_activities, comment_food, comment_transparency, comment_safety, comment_night_weekend",
      )
      .eq("id", testReviewId)
      .single();

    const row = data as Record<string, string>;
    for (const cat of REVIEW_CATEGORIES) {
      const val = row[`comment_${cat.key}`];
      expect(typeof val).toBe("string");
      expect(val).toContain(cat.label);
    }
  });

  it.skipIf(SKIP)("status is 'pending' immediately after submission", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("status")
      .eq("id", testReviewId)
      .single();
    expect((data as { status: string }).status).toBe("pending");
  });

  it.skipIf(SKIP)("created_at is a valid ISO timestamp", async () => {
    if (!testReviewId) return;
    const { data } = await serviceRoleClient()
      .from("reviews")
      .select("created_at")
      .eq("id", testReviewId)
      .single();
    const ts = (data as { created_at: string }).created_at;
    expect(new Date(ts).getTime()).not.toBeNaN();
    // Should be within the last 60 seconds
    expect(Date.now() - new Date(ts).getTime()).toBeLessThan(60_000);
  });
});

// ─── 3. RLS: public client cannot see the pending review ─────────────────────

describe("07 · Reviews — RLS: pending review is invisible to public client", () => {
  it.skipIf(SKIP)(
    "public client returns 0 rows for the pending review ID",
    async () => {
      if (!testReviewId) return;
      const { data } = await publicClient()
        .from("reviews")
        .select("id, status")
        .eq("id", testReviewId);
      expect((data ?? []).length).toBe(0);
    },
  );

  it.skipIf(SKIP)(
    "loadPublishedReviews() does not include the pending review",
    async () => {
      if (!testReviewId) return;
      const reviews = await loadPublishedReviews(testFacilityId);
      const found = reviews.find((r) => (r as { id: string }).id === testReviewId);
      expect(found).toBeUndefined();
    },
  );
});

// ─── 4. Promote to published and verify public visibility ─────────────────────

describe("07 · Reviews — publish lifecycle: pending → published", () => {
  it.skipIf(SKIP)("service role can update status to published", async () => {
    if (!testReviewId) return;
    const { error } = await serviceRoleClient()
      .from("reviews")
      .update({ status: "published" })
      .eq("id", testReviewId);
    expect(error).toBeNull();
  });

  it.skipIf(SKIP)("public client can now read the review", async () => {
    if (!testReviewId) return;
    const { data } = await publicClient()
      .from("reviews")
      .select("id, status")
      .eq("id", testReviewId);
    expect((data ?? []).length).toBe(1);
    expect(((data ?? [])[0] as { status: string }).status).toBe("published");
  });

  it.skipIf(SKIP)("loadPublishedReviews() now includes the published review", async () => {
    if (!testReviewId) return;
    const reviews = await loadPublishedReviews(testFacilityId);
    const found = reviews.find(
      (r: unknown) => (r as { id: string }).id === testReviewId,
    );
    expect(found).toBeDefined();
  });

  it.skipIf(SKIP)("published review from loadPublishedReviews has all expected fields", async () => {
    if (!testReviewId) return;
    const reviews = await loadPublishedReviews(testFacilityId);
    const review = reviews.find(
      (r: unknown) => (r as { id: string }).id === testReviewId,
    ) as Record<string, unknown> | undefined;
    expect(review).toBeDefined();
    if (!review) return;

    // Verify the full Review shape
    expect(review.id).toBe(testReviewId);
    expect(review.facility_id).toBe(testFacilityId);
    expect(review.reviewer_name).toBe("Integration Test User");
    expect(review.reviewer_relationship).toBe("Family member of current resident");
    expect(review.status).toBe("published");

    // All 7 ratings
    for (const cat of REVIEW_CATEGORIES) {
      expect(review[`rating_${cat.key}`]).toBe(4);
    }

    // created_at
    expect(new Date(review.created_at as string).getTime()).not.toBeNaN();
  });
});

// ─── 5. Rejected review is not publicly visible ───────────────────────────────

describe("07 · Reviews — rejected status is not publicly visible", () => {
  it.skipIf(SKIP)("service role can update status to rejected", async () => {
    if (!testReviewId) return;
    const { error } = await serviceRoleClient()
      .from("reviews")
      .update({ status: "rejected" })
      .eq("id", testReviewId);
    expect(error).toBeNull();
  });

  it.skipIf(SKIP)("public client cannot see rejected review", async () => {
    if (!testReviewId) return;
    const { data } = await publicClient()
      .from("reviews")
      .select("id")
      .eq("id", testReviewId);
    expect((data ?? []).length).toBe(0);
  });
});

// ─── 6. Validation errors from submitReview ───────────────────────────────────

describe("07 · Reviews — validation: invalid inputs return field errors", () => {
  it.skipIf(SKIP)("missing reviewer_name returns a field error", async () => {
    const fd = makeValidFormData({ reviewer_name: "" });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.reviewer_name).toBeDefined();
  });

  it.skipIf(SKIP)("reviewer_name over 100 chars returns a field error", async () => {
    const longName = "A".repeat(101);
    const fd = makeValidFormData({ reviewer_name: longName });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.reviewer_name).toBeDefined();
  });

  it.skipIf(SKIP)("invalid reviewer_relationship returns a field error", async () => {
    const fd = makeValidFormData({ reviewer_relationship: "Random invalid option" });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.reviewer_relationship).toBeDefined();
  });

  it.skipIf(SKIP)("overall_summary over 2000 chars returns a field error", async () => {
    const fd = makeValidFormData({ overall_summary: "A".repeat(2001) });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.overall_summary).toBeDefined();
  });

  it.skipIf(SKIP)("invalid reviewer_email format returns a field error", async () => {
    const fd = makeValidFormData({ reviewer_email: "not-an-email" });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.reviewer_email).toBeDefined();
  });

  it.skipIf(SKIP)("rating of 0 returns a field error", async () => {
    const fd = makeValidFormData({ rating_staff_engagement: "0" });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.rating_staff_engagement).toBeDefined();
  });

  it.skipIf(SKIP)("rating of 6 returns a field error", async () => {
    const fd = makeValidFormData({ rating_staff_engagement: "6" });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.rating_staff_engagement).toBeDefined();
  });

  it.skipIf(SKIP)("non-numeric rating returns a field error", async () => {
    const fd = makeValidFormData({ rating_personal_care: "excellent" });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.rating_personal_care).toBeDefined();
  });

  it.skipIf(SKIP)("comment over 1000 chars returns a field error", async () => {
    const fd = makeValidFormData({ comment_food: "B".repeat(1001) });
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.comment_food).toBeDefined();
  });

  it.skipIf(SKIP)("all valid inputs with rating=1 return success", async () => {
    // Min boundary
    const fd = new FormData();
    fd.set("reviewer_name", "Min Boundary Test");
    fd.set("reviewer_relationship", "Other");
    fd.set("overall_summary", "");
    fd.set("reviewer_email", "");
    for (const cat of REVIEW_CATEGORIES) {
      fd.set(`rating_${cat.key}`, "1");
      fd.set(`comment_${cat.key}`, "");
    }
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("success");

    // Cleanup the extra review
    await serviceRoleClient()
      .from("reviews")
      .delete()
      .eq("facility_id", testFacilityId)
      .eq("reviewer_name", "Min Boundary Test");
  });

  it.skipIf(SKIP)("all valid inputs with rating=5 return success", async () => {
    // Max boundary
    const fd = makeValidFormData();
    for (const cat of REVIEW_CATEGORIES) {
      fd.set(`rating_${cat.key}`, "5");
    }
    const result = await submitReview(testFacilityId, { status: "idle" }, fd);
    expect(result.status).toBe("success");

    // Cleanup
    await serviceRoleClient()
      .from("reviews")
      .delete()
      .eq("facility_id", testFacilityId)
      .eq("reviewer_name", "Integration Test User")
      .eq("reviewer_email", "test-integration@example.com")
      .neq("id", testReviewId ?? "00000000-0000-0000-0000-000000000000");
  });
});

// ─── 7. loadPublishedReviews field shape ──────────────────────────────────────

describe("07 · Reviews — loadPublishedReviews returns correct shape", () => {
  it.skipIf(SKIP)("returns an array for a facility with no published reviews", async () => {
    // Use a facility that is unlikely to have published reviews.
    const { data: fac } = await serviceRoleClient()
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .limit(1)
      .single();

    if (!fac) return;
    const reviews = await loadPublishedReviews((fac as { id: string }).id);
    expect(Array.isArray(reviews)).toBe(true);
  });
});
