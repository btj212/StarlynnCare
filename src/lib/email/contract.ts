import { canonicalFor } from "@/lib/seo/canonical";

/**
 * Acknowledgment email for the Contract Decoder offer.
 * Tells the user to reply with their PDF; no facility data needed.
 *
 * Template setup in Loops:
 *   Subject: We got your request — here's how to send your contract
 *   Variables: unsubscribeUrl
 *   Body (plain text):
 *     We received your request. To get your contract decoded:
 *     1. Reply to this email with the admission agreement PDF attached.
 *     2. We'll map every fee escalation, discharge trigger, and arbitration clause
 *        into plain language and email it back within 2 business days.
 *
 *     What we look for:
 *     • Fee escalation clauses — when rates can increase and by how much
 *     • Discharge triggers — grounds the facility can use to ask you to leave
 *     • Arbitration clauses — whether you're waiving your right to sue
 *     • Refund policies — what happens if a resident leaves in the first 30–90 days
 *     • Ancillary fee schedules — extras not in the headline monthly rate
 *
 *     StarlynnCare receives no referral commissions or fees from facilities.
 *
 *     Unsubscribe: {unsubscribeUrl}
 */
export async function sendContractAck({ to }: { to: string }): Promise<void> {
  const transactionalId = process.env.LOOPS_CONTRACT_EMAIL_ID;
  const apiKey = process.env.LOOPS_API_KEY;

  if (!apiKey || !transactionalId) {
    console.error("[contract-email] LOOPS_API_KEY or LOOPS_CONTRACT_EMAIL_ID not set — skipping email");
    return;
  }

  // We don't have a facility-specific unsubscribe token for the contract offer
  // (no facility_watchers row is created). Use a generic contact management URL.
  const unsubscribeUrl = canonicalFor("/unsubscribe");

  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email: to,
      transactionalId,
      dataVariables: { unsubscribeUrl },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[contract-email] Loops transactional error ${res.status}: ${body}`);
  }
}
