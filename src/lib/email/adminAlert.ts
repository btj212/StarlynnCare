import { canonicalFor } from "@/lib/seo/canonical";

const TYPE_LABEL: Record<string, string> = {
  facility_watch:    "Facility Watch",
  area_watch:        "Area Watch",
  digest_subscriber: "Library Magnet / Digest",
  shortlist_watch:   "Shortlist",
  contract_review:   "Contract Review",
  listing_report:    "Listing Report",
  review:            "Review",
  waitlist:          "Waitlist",
};

export async function sendAdminAlert({
  eventType,
  email,
  summary,
  details,
  submittedAt,
}: {
  eventType: string;
  email: string;
  summary: string;
  details: string;
  submittedAt: string;
}): Promise<void> {
  const apiKey     = process.env.LOOPS_API_KEY;
  const templateId = process.env.LOOPS_ADMIN_ALERT_ID;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;

  if (!apiKey || !templateId || !adminEmail) {
    console.error(
      "[admin-alert] LOOPS_API_KEY, LOOPS_ADMIN_ALERT_ID, or ADMIN_ALERT_EMAIL not set — skipping alert"
    );
    return;
  }

  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email: adminEmail,
      transactionalId: templateId,
      dataVariables: {
        submissionType: TYPE_LABEL[eventType] ?? eventType,
        email,
        summary,
        details: details.length > 800 ? details.slice(0, 797) + "…" : details,
        submittedAt,
        adminUrl: canonicalFor("/admin/submissions"),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[admin-alert] Loops API error ${res.status}: ${body}`);
  }
}
