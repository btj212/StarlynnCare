import { canonicalFor } from "@/lib/seo/canonical";

export async function sendListingReportAlert({
  facilityId,
  facilityName,
  reason,
  contactEmail,
  reportId,
}: {
  facilityId: string;
  facilityName: string;
  reason: string;
  contactEmail: string | null;
  reportId: string;
}): Promise<void> {
  const apiKey = process.env.LOOPS_API_KEY;
  const transactionalId = process.env.LOOPS_REPORT_ALERT_ID;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;

  if (!apiKey || !transactionalId || !adminEmail) {
    console.error(
      "[listing-report] LOOPS_API_KEY, LOOPS_REPORT_ALERT_ID, or ADMIN_ALERT_EMAIL not set — skipping alert"
    );
    return;
  }

  // Derive state from the admin review URL — we don't have state in scope here,
  // so point straight to the mc-review queue which lists all open reports.
  const reviewUrl = canonicalFor(`/admin/mc-review`);
  const facilityUrl = canonicalFor(`/facilities/${facilityId}`);

  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email: adminEmail,
      transactionalId,
      dataVariables: {
        facilityName,
        reason: reason.length > 300 ? reason.slice(0, 297) + "…" : reason,
        contactEmail: contactEmail ?? "not provided",
        reportId,
        reviewUrl,
        facilityUrl,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[listing-report] Loops API error ${res.status}: ${body}`);
  }
}
