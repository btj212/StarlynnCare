import { canonicalFor } from "@/lib/seo/canonical";

export async function sendWatchConfirmation({
  to,
  facilityName,
  confirmationToken,
}: {
  to: string;
  facilityName: string;
  confirmationToken: string;
}): Promise<void> {
  const apiKey = process.env.LOOPS_API_KEY;
  const transactionalId = process.env.LOOPS_WATCH_CONFIRM_ID;

  if (!apiKey || !transactionalId) {
    console.error("[watch] LOOPS_API_KEY or LOOPS_WATCH_CONFIRM_ID not set — skipping email");
    return;
  }

  const confirmUrl = canonicalFor(`/watch/confirm/${confirmationToken}`);
  const unsubscribeUrl = canonicalFor(`/watch/unsubscribe/${confirmationToken}`);

  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email: to,
      transactionalId,
      dataVariables: {
        facilityName,
        confirmUrl,
        unsubscribeUrl,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[watch] Loops API error ${res.status}: ${body}`);
  }
}
