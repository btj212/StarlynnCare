import { envTrim } from "@/lib/stripe/server";
import type { PartnerInterval, PartnerPlan } from "@/lib/partners/constants";

/**
 * Checkout stays off until counsel has reviewed the terms and tour consent
 * and the insurance is in place. Set PARTNER_CHECKOUT_ENABLED=1 to open it.
 * Do not put that value in a committed env file from this repo.
 */
export function isPartnerCheckoutEnabled(): boolean {
  return process.env.PARTNER_CHECKOUT_ENABLED?.trim() === "1";
}

export function isPartnerBillingConfigured(): boolean {
  return Boolean(
    envTrim("STRIPE_SECRET_KEY") &&
      envTrim("STRIPE_WEBHOOK_SECRET") &&
      envTrim("STRIPE_PRICE_PARTNER_FOUNDING_MONTHLY") &&
      envTrim("STRIPE_PRICE_PARTNER_FOUNDING_ANNUAL") &&
      envTrim("STRIPE_PRICE_PARTNER_STANDARD_MONTHLY") &&
      envTrim("STRIPE_PRICE_PARTNER_STANDARD_ANNUAL"),
  );
}

export function priceIdForPartnerPlan(plan: PartnerPlan, interval: PartnerInterval): string {
  const name =
    plan === "founding"
      ? interval === "year"
        ? "STRIPE_PRICE_PARTNER_FOUNDING_ANNUAL"
        : "STRIPE_PRICE_PARTNER_FOUNDING_MONTHLY"
      : interval === "year"
        ? "STRIPE_PRICE_PARTNER_STANDARD_ANNUAL"
        : "STRIPE_PRICE_PARTNER_STANDARD_MONTHLY";
  const priceId = envTrim(name);
  if (!priceId) throw new Error(`[partners] Missing ${name}`);
  return priceId;
}

export function partnerPlanForPriceId(priceId: string): {
  plan: PartnerPlan;
  interval: PartnerInterval;
} | null {
  const foundingMonth = envTrim("STRIPE_PRICE_PARTNER_FOUNDING_MONTHLY");
  const foundingYear = envTrim("STRIPE_PRICE_PARTNER_FOUNDING_ANNUAL");
  const standardMonth = envTrim("STRIPE_PRICE_PARTNER_STANDARD_MONTHLY");
  const standardYear = envTrim("STRIPE_PRICE_PARTNER_STANDARD_ANNUAL");
  if (priceId === foundingMonth) return { plan: "founding", interval: "month" };
  if (priceId === foundingYear) return { plan: "founding", interval: "year" };
  if (priceId === standardMonth) return { plan: "standard", interval: "month" };
  if (priceId === standardYear) return { plan: "standard", interval: "year" };
  return null;
}
