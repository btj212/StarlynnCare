import { canonicalFor } from "@/lib/seo/canonical";
import type { WatchWelcomeDigest } from "@/lib/watch/buildWatchWelcomeDigest";

/** @deprecated Confirm flow removed — watchers are active on signup. */
export async function sendWatchConfirmation({
  to,
  facilityName,
  unsubscribeToken,
}: {
  to: string;
  facilityName: string;
  confirmationToken?: string;
  unsubscribeToken: string;
}): Promise<void> {
  return sendWatchWelcome({
    to,
    facilityName,
    unsubscribeToken,
    digest: null,
  });
}

/** Sent immediately on signup — welcome digest with current record snapshot. */
export async function sendWatchWelcome({
  to,
  facilityName,
  unsubscribeToken,
  digest,
}: {
  to: string;
  facilityName: string;
  unsubscribeToken: string;
  digest: WatchWelcomeDigest | null;
}): Promise<void> {
  const apiKey = process.env.LOOPS_API_KEY;
  const transactionalId =
    process.env.LOOPS_WATCH_WELCOME_ID ?? process.env.LOOPS_WATCH_CONFIRM_ID;

  if (!apiKey || !transactionalId) {
    console.error(
      "[watch] LOOPS_API_KEY or LOOPS_WATCH_WELCOME_ID / LOOPS_WATCH_CONFIRM_ID not set — skipping email",
    );
    return;
  }

  const unsubscribeUrl = canonicalFor(`/watch/unsubscribe/${unsubscribeToken}`);

  const dataVariables = digest
    ? { ...digest }
    : {
        facilityName,
        facilityUrl: "",
        cityState: "",
        licenseNumber: "",
        recordSummary: `You're now watching ${facilityName}. We'll email you when the public record changes.`,
        lastActivityDate: "—",
        lastActivityType: "—",
        quietPeriodLine: "",
        recentEventsText: "",
        statsLine: "",
        severityRankLine: "",
        whatWeWatch:
          "• New state inspections or complaint investigations\n• New violations or regulatory actions\n• License or endorsement changes",
        unsubscribeUrl,
      };

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
        ...dataVariables,
        unsubscribeUrl: dataVariables.unsubscribeUrl ?? unsubscribeUrl,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[watch] Loops API error ${res.status}: ${body}`);
  }
}
