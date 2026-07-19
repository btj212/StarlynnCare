import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Trim CLI/env newlines — `vercel env add` via printf can leave a trailing \\n. */
function envTrim(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Server-only Stripe client. Throws if STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe {
  const key = envTrim("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("[stripe] STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    envTrim("STRIPE_SECRET_KEY") &&
      envTrim("STRIPE_WEBHOOK_SECRET") &&
      envTrim("STRIPE_PRICE_FACILITY_WATCH_MONTHLY") &&
      envTrim("STRIPE_PRICE_FACILITY_WATCH_ANNUAL"),
  );
}

export type BillingInterval = "month" | "year";

export function priceIdForInterval(interval: BillingInterval): string {
  const priceId =
    interval === "year"
      ? envTrim("STRIPE_PRICE_FACILITY_WATCH_ANNUAL")
      : envTrim("STRIPE_PRICE_FACILITY_WATCH_MONTHLY");
  if (!priceId) {
    throw new Error(`[stripe] Missing price ID for interval=${interval}`);
  }
  return priceId;
}

export function intervalForPriceId(priceId: string): BillingInterval | null {
  if (priceId === envTrim("STRIPE_PRICE_FACILITY_WATCH_MONTHLY")) return "month";
  if (priceId === envTrim("STRIPE_PRICE_FACILITY_WATCH_ANNUAL")) return "year";
  return null;
}
