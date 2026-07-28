/**
 * Ahrefs Web Analytics custom events.
 *
 * Script is loaded in layout.tsx (`analytics.ahrefs.com/analytics.js`).
 * All helpers no-op when the global is absent (SSR, ad blockers, preview).
 */

declare global {
  interface Window {
    AhrefsAnalytics?: {
      sendEvent: (
        name: string,
        options?: {
          props?: Record<string, string>;
          meta?: Record<string, unknown>;
          callback?: (result: { status: number }) => void;
        },
      ) => void;
    };
  }
}

function send(name: string, props?: Record<string, string>) {
  if (typeof window === "undefined") return;
  const api = window.AhrefsAnalytics;
  if (!api || typeof api.sendEvent !== "function") return;
  api.sendEvent(name, props ? { props } : undefined);
}

/** Paid Facility Watch — redirected to Stripe Checkout. */
export function emitAhrefsPaidWatchCheckoutStart(interval: "month" | "year") {
  send("paid_watch_checkout_start", { interval });
}
