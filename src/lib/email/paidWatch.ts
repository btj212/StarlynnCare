import { canonicalFor } from "@/lib/seo/canonical";
import type { BillingInterval } from "@/lib/stripe/server";
import {
  PAID_WATCH_ANNUAL_USD,
  PAID_WATCH_MONTHLY_USD,
} from "@/lib/facility-watch/paidConfig";

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

function priceLabel(interval: BillingInterval): string {
  return interval === "year"
    ? `$${PAID_WATCH_ANNUAL_USD}/year`
    : `$${PAID_WATCH_MONTHLY_USD}/month`;
}

/** Welcome after successful paid checkout — monitoring activates within one business day. */
export async function sendPaidWatchWelcome({
  to,
  facilityName,
  facilityUrl,
  billingInterval,
  manageUrl,
}: {
  to: string;
  facilityName: string;
  facilityUrl: string;
  billingInterval: BillingInterval;
  manageUrl: string;
}): Promise<void> {
  const transactionalId = process.env.LOOPS_PAID_WATCH_WELCOME_ID;
  if (!transactionalId) {
    console.error(
      "[paid-watch] LOOPS_PAID_WATCH_WELCOME_ID not set — skipping welcome email",
    );
    return;
  }

  await sendLoopsTransactional(to, transactionalId, {
    facilityName,
    facilityUrl,
    planLabel: priceLabel(billingInterval),
    manageUrl,
    supportEmail: process.env.ADMIN_ALERT_EMAIL ?? "hello@starlynncare.com",
    siteUrl: canonicalFor("/"),
  });
}

export async function sendPaidWatchPaymentFailed({
  to,
  facilityName,
  manageUrl,
}: {
  to: string;
  facilityName: string;
  manageUrl: string;
}): Promise<void> {
  const transactionalId = process.env.LOOPS_PAID_WATCH_PAYMENT_FAILED_ID;
  if (!transactionalId) {
    console.error(
      "[paid-watch] LOOPS_PAID_WATCH_PAYMENT_FAILED_ID not set — skipping payment-failed email",
    );
    return;
  }

  await sendLoopsTransactional(to, transactionalId, {
    facilityName,
    manageUrl,
    supportEmail: process.env.ADMIN_ALERT_EMAIL ?? "hello@starlynncare.com",
  });
}
