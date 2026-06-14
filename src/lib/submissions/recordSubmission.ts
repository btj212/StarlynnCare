import { getServiceClient } from "@/lib/supabase/server";
import { sendAdminAlert } from "@/lib/email/adminAlert";

export type SubmissionEventType =
  | "facility_watch"
  | "area_watch"
  | "digest_subscriber"
  | "listing_report"
  | "review"
  | "waitlist"
  | "shortlist_watch"
  | "contract_review";

export interface RecordSubmissionArgs {
  type: SubmissionEventType;
  email: string;
  summary: string;
  /** e.g. "sticky_bar", "modal", "report_waitlist", page path */
  source?: string | null;
  /** UUID of the related facility, if applicable */
  facilityId?: string | null;
  /** Arbitrary extra context rendered in the admin alert email */
  payload?: Record<string, unknown>;
}

/**
 * Inserts a row into `submission_events` and fires an admin alert email.
 * Never throws — failure here must not affect the user-facing response.
 * Call fire-and-forget from API routes:
 *   recordSubmission({ ... }).catch(err => console.error(...))
 */
export async function recordSubmission(args: RecordSubmissionArgs): Promise<void> {
  const { type, email, summary, source, facilityId, payload = {} } = args;
  const submittedAt = new Date().toISOString();

  const supabase = getServiceClient();

  // Insert the ledger row first so we always have an audit trail even if the
  // alert delivery fails. We update alert_status in-place after the Loops call.
  //
  // Retry a few times: this is called fire-and-forget from the API routes, so a
  // transient insert failure would otherwise silently drop the row (the contact
  // still reaches Loops on a separate awaited call), leaving /admin/submissions
  // missing a capture with no signal. NOTE: `type` must be in the
  // submission_events event_type CHECK (see migration 0048) — a type the DB
  // rejects is deterministic and won't be saved by retrying.
  const insertPayload = {
    event_type:   type,
    email,
    source:       source ?? null,
    facility_id:  facilityId ?? null,
    summary,
    payload,
    alert_status: "pending",
    created_at:   submittedAt,
  };

  let row: { id: string } | null = null;
  let insertError: { message: string } | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await supabase
      .from("submission_events")
      .insert(insertPayload)
      .select("id")
      .single();
    if (!res.error && res.data) {
      row = res.data;
      insertError = null;
      break;
    }
    insertError = res.error;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 200 * attempt));
  }

  if (!row) {
    console.error(
      "[record-submission] insert failed after retries:",
      insertError?.message,
    );
    return;
  }

  // Build a readable details block for the email body.
  const detailLines: string[] = [`type: ${type}`, `source: ${source ?? "—"}`];
  if (facilityId) detailLines.push(`facility_id: ${facilityId}`);
  for (const [k, v] of Object.entries(payload)) {
    if (v != null && v !== "") {
      const str = typeof v === "string" ? v : JSON.stringify(v);
      detailLines.push(`${k}: ${str.slice(0, 300)}`);
    }
  }
  const details = detailLines.join("\n");

  const hasAlertConfig =
    !!process.env.LOOPS_API_KEY &&
    !!process.env.LOOPS_ADMIN_ALERT_ID &&
    !!process.env.ADMIN_ALERT_EMAIL;

  let alertStatus: "sent" | "failed" | "skipped" = hasAlertConfig ? "sent" : "skipped";
  let alertError: string | null = null;

  if (hasAlertConfig) {
    try {
      await sendAdminAlert({ eventType: type, email, summary, details, submittedAt });
    } catch (err) {
      alertStatus = "failed";
      alertError = err instanceof Error ? err.message : String(err);
      console.error("[record-submission] alert failed:", alertError);
    }
  }

  // Best-effort update — not awaited on the critical path.
  supabase
    .from("submission_events")
    .update({ alert_status: alertStatus, alert_error: alertError })
    .eq("id", row.id)
    .then(({ error }) => {
      if (error) console.error("[record-submission] status update failed:", error.message);
    });
}
