import { getServiceClient } from "@/lib/supabase/server";
import { sendAdminAlert } from "@/lib/email/adminAlert";

export type SubmissionEventType =
  | "facility_watch"
  | "area_watch"
  | "listing_report"
  | "review"
  | "waitlist";

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
  const { data: row, error: insertError } = await supabase
    .from("submission_events")
    .insert({
      event_type:   type,
      email,
      source:       source ?? null,
      facility_id:  facilityId ?? null,
      summary,
      payload,
      alert_status: "pending",
      created_at:   submittedAt,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[record-submission] insert failed:", insertError?.message);
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

  let alertStatus: "sent" | "failed" = "sent";
  let alertError: string | null = null;

  try {
    await sendAdminAlert({ eventType: type, email, summary, details, submittedAt });
  } catch (err) {
    alertStatus = "failed";
    alertError = err instanceof Error ? err.message : String(err);
    console.error("[record-submission] alert failed:", alertError);
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
