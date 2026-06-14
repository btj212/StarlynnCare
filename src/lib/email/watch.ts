import { canonicalFor } from "@/lib/seo/canonical";
import type { WatchWelcomeDigest } from "@/lib/watch/buildWatchWelcomeDigest";
import type { TourEmailDigest } from "@/lib/email/buildTourEmailDigest";

// ─── shared Loops send helper ──────────────────────────────────────────────

async function sendLoopsTransactional(
  to: string,
  transactionalId: string,
  dataVariables: Record<string, string>,
): Promise<void> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.error("[email] LOOPS_API_KEY not set — skipping transactional send");
    return;
  }
  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ email: to, transactionalId, dataVariables }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[email] Loops transactional error ${res.status}: ${body}`);
  }
}

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
  const transactionalId =
    process.env.LOOPS_WATCH_WELCOME_ID ?? process.env.LOOPS_WATCH_CONFIRM_ID;

  if (!transactionalId) {
    console.error("[watch] LOOPS_WATCH_WELCOME_ID / LOOPS_WATCH_CONFIRM_ID not set — skipping email");
    return;
  }

  const unsubscribeUrl = canonicalFor(`/watch/unsubscribe/${unsubscribeToken}`);

  const dataVariables: Record<string, string> = digest
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
          "• New inspection records posted on the public regulator file\n• New violations or regulatory actions for this facility\n• License or memory-care endorsement status changes",
        unsubscribeUrl,
      };

  await sendLoopsTransactional(to, transactionalId, {
    ...dataVariables,
    unsubscribeUrl: dataVariables.unsubscribeUrl ?? unsubscribeUrl,
  });
}

/**
 * Records delivery email — same data as watch welcome, different copy.
 * Sent when a visitor converts on the "Get the full inspection record" offer.
 */
export async function sendRecordsEmail({
  to,
  digest,
  unsubscribeToken,
}: {
  to: string;
  digest: WatchWelcomeDigest | null;
  unsubscribeToken: string;
}): Promise<void> {
  const transactionalId = process.env.LOOPS_RECORDS_EMAIL_ID;
  if (!transactionalId) {
    console.error("[records-email] LOOPS_RECORDS_EMAIL_ID not set — skipping email");
    return;
  }

  const unsubscribeUrl = canonicalFor(`/watch/unsubscribe/${unsubscribeToken}`);
  const vars: Record<string, string> = digest
    ? { ...digest, unsubscribeUrl }
    : { facilityName: "", facilityUrl: "", recordSummary: "", recentEventsText: "", severityRankLine: "", quietPeriodLine: "", unsubscribeUrl };

  await sendLoopsTransactional(to, transactionalId, vars);
}

/**
 * Tour prep email — sends the facility-specific question checklist.
 * Sent when a visitor converts on the "Get a tour-prep pack" offer.
 */
export async function sendTourEmail({
  to,
  digest,
  unsubscribeToken,
}: {
  to: string;
  digest: TourEmailDigest;
  unsubscribeToken: string;
}): Promise<void> {
  const transactionalId = process.env.LOOPS_TOUR_EMAIL_ID;
  if (!transactionalId) {
    console.error("[tour-email] LOOPS_TOUR_EMAIL_ID not set — skipping email");
    return;
  }

  const unsubscribeUrl = canonicalFor(`/watch/unsubscribe/${unsubscribeToken}`);

  await sendLoopsTransactional(to, transactionalId, { ...digest, unsubscribeUrl });
}
