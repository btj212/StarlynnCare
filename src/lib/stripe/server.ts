import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Server-only Stripe client. Throws if STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
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
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_FACILITY_WATCH_MONTHLY &&
      process.env.STRIPE_PRICE_FACILITY_WATCH_ANNUAL,
  );
}

export type BillingInterval = "month" | "year";

export function priceIdForInterval(interval: BillingInterval): string {
  const priceId =
    interval === "year"
      ? process.env.STRIPE_PRICE_FACILITY_WATCH_ANNUAL
      : process.env.STRIPE_PRICE_FACILITY_WATCH_MONTHLY;
  if (!priceId) {
    throw new Error(`[stripe] Missing price ID for interval=${interval}`);
  }
  return priceId;
}

export function intervalForPriceId(priceId: string): BillingInterval | null {
  if (priceId === process.env.STRIPE_PRICE_FACILITY_WATCH_MONTHLY) return "month";
  if (priceId === process.env.STRIPE_PRICE_FACILITY_WATCH_ANNUAL) return "year";
  return null;
}
