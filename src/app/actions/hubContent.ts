"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUserIsAdmin } from "@/lib/admin/auth";
import { sanitizeHubHtml, verifyHubStats } from "@/lib/content/hubGate";
import { stateFromCode } from "@/lib/states";

/**
 * Result shape for the editor: gate failures come back as structured `issues`
 * (rendered to the admin) rather than thrown, so a number mismatch is surfaced,
 * not a 500. Auth failures still throw — the proxy middleware should have caught
 * those already (this is the belt-and-suspenders check from moderateReview.ts).
 */
export type HubActionResult = { ok: true } | { ok: false; issues: string[] };

/** Belt-and-suspenders admin check; returns the approver's email for provenance. */
async function requireAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await currentUserIsAdmin())) throw new Error("Forbidden");
  const user = await currentUser();
  return user?.emailAddresses?.[0]?.emailAddress ?? userId;
}

type HubRow = {
  state_code: string;
  region_slug: string;
  body_html: string | null;
  stats_snapshot: Record<string, unknown>;
  drift_detected: boolean;
  status: string;
};

async function loadRow(id: string): Promise<HubRow> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("hub_content")
    .select(
      "state_code, region_slug, body_html, stats_snapshot, drift_detected, status",
    )
    .eq("id", id)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Hub content row not found");
  }
  return data as HubRow;
}

/** Revalidate the public city page (by state slug) and the admin queue. */
function revalidateRegion(stateCode: string, regionSlug: string): void {
  const slug = stateFromCode(stateCode)?.slug;
  if (slug) revalidatePath(`/${slug}/${regionSlug}`);
  revalidatePath("/admin/hub-content");
}

/**
 * Persist an admin's edits. Sanitizes the body and runs the numeric gate against
 * the row's grounded snapshot — a save that would introduce a number disagreeing
 * with the snapshot is rejected, never silently stored. Moves drafts into
 * `in_review`; leaves a published row published (its body stays live, still gated).
 */
export async function saveHubContent(
  id: string,
  title: string,
  bodyHtml: string,
): Promise<HubActionResult> {
  await requireAdmin();
  const row = await loadRow(id);
  const clean = sanitizeHubHtml(bodyHtml);

  const issues = verifyHubStats(clean, row.stats_snapshot);
  if (issues.length) return { ok: false, issues };

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("hub_content")
    .update({
      title: title.trim() || null,
      body_html: clean,
      status: row.status === "published" ? "published" : "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateRegion(row.state_code, row.region_slug);
  return { ok: true };
}

/**
 * Approve + publish. The approval gate: the stored body must pass the numeric
 * gate against its snapshot, and the row must not be drift-flagged. Because the
 * post-ingest drift audit keeps `drift_detected` honest against the live DB,
 * "tokens == snapshot AND not drifted" means the published numbers match the DB
 * — no human has to check them.
 */
export async function publishHubContent(id: string): Promise<HubActionResult> {
  const approvedBy = await requireAdmin();
  const row = await loadRow(id);

  if (!row.body_html) {
    return { ok: false, issues: ["No body content to publish."] };
  }
  if (row.drift_detected) {
    return {
      ok: false,
      issues: [
        "This row is flagged as drifted — its grounded numbers no longer match the database. Regenerate the draft before publishing.",
      ],
    };
  }

  const issues = verifyHubStats(row.body_html, row.stats_snapshot);
  if (issues.length) return { ok: false, issues };

  const now = new Date().toISOString();
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("hub_content")
    .update({
      status: "published",
      approved_by: approvedBy,
      approved_at: now,
      published_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateRegion(row.state_code, row.region_slug);
  return { ok: true };
}

/** Pull a published page back to draft (e.g. to revise it). */
export async function unpublishHubContent(id: string): Promise<HubActionResult> {
  await requireAdmin();
  const row = await loadRow(id);
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("hub_content")
    .update({
      status: "draft",
      published_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateRegion(row.state_code, row.region_slug);
  return { ok: true };
}
