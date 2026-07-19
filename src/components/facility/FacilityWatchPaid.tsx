"use client";

import { useEffect, useState } from "react";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD } from "@/lib/security/honeypot";
import {
  PAID_WATCH_ANCHOR,
  PAID_WATCH_ANNUAL_USD,
  PAID_WATCH_MONTHLY_USD,
} from "@/lib/facility-watch/paidConfig";
import {
  emitPaidWatchCheckoutStart,
  emitPaidWatchImpression,
  emitPaidWatchPlanSelect,
} from "@/lib/analytics/clarityEvents";

type Interval = "month" | "year";
type FormState = "idle" | "submitting" | "error";

interface FacilityWatchPaidProps {
  facilityId: string;
  facilityName: string;
}

export function FacilityWatchPaid({
  facilityId,
  facilityName,
}: FacilityWatchPaidProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [interval, setInterval] = useState<Interval>("month");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    emitPaidWatchImpression();
  }, []);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === `#${PAID_WATCH_ANCHOR}`) {
        setOpen(true);
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const selectPlan = (next: Interval) => {
    setInterval(next);
    emitPaidWatchPlanSelect(next);
  };

  const startCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setState("submitting");
    setErrorMsg("");
    emitPaidWatchCheckoutStart(interval);

    try {
      const res = await fetch("/api/facility-watch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          facilityId,
          interval,
          [HONEYPOT_FIELD]: honeypot,
          [HONEYPOT_TS_FIELD]: renderedAt,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        manageUrl?: string;
        alreadyActive?: boolean;
        error?: string;
      };

      if (!res.ok) {
        setErrorMsg(data.error ?? "Could not start checkout. Try again.");
        setState("error");
        return;
      }

      if (data.alreadyActive && data.manageUrl) {
        window.location.href = data.manageUrl;
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setErrorMsg("Could not start checkout. Try again.");
      setState("error");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  return (
    <section
      id={PAID_WATCH_ANCHOR}
      className="w-full border-b border-paper-rule py-10 px-4 md:px-8 scroll-mt-24"
      style={{ backgroundColor: "var(--color-paper-2)" }}
    >
      <div className="mx-auto max-w-[1280px]">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-ink-4 mb-2">
          Facility Watch · Premium
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[26px] leading-snug text-ink md:text-[30px] max-w-[40ch]">
          Does your loved one live here already?
        </h2>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          Try Facility Watch — we monitor news, public reviews and complaint
          mentions we can find across the web, plus official inspection and
          license-record changes for {facilityName}, and flag anything material
          to you, usually within a day of it appearing online. Nothing is swept
          under the rug.
        </p>
        <p className="mt-2 max-w-[62ch] font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-3">
          ${PAID_WATCH_MONTHLY_USD}/month or ${PAID_WATCH_ANNUAL_USD}/year ·
          Official-record alerts included · Cancel anytime
        </p>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 h-11 px-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-ink)" }}
          >
            Start Facility Watch →
          </button>
        ) : (
          <form
            onSubmit={startCheckout}
            className="mt-6 max-w-[520px] space-y-4 border border-paper-rule bg-paper p-5"
          >
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "month" as const,
                    label: `$${PAID_WATCH_MONTHLY_USD}/month`,
                    sub: "Cancel anytime",
                  },
                  {
                    value: "year" as const,
                    label: `$${PAID_WATCH_ANNUAL_USD}/year`,
                    sub: "Best value",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectPlan(opt.value)}
                  className="border px-3 py-3 text-left transition-colors"
                  style={{
                    borderColor:
                      interval === opt.value
                        ? "var(--color-teal)"
                        : "var(--color-paper-rule)",
                    backgroundColor:
                      interval === opt.value
                        ? "color-mix(in srgb, var(--color-teal) 8%, white)"
                        : "transparent",
                  }}
                >
                  <span className="block font-[family-name:var(--font-mono)] text-[12px] tracking-[0.06em] text-ink">
                    {opt.label}
                  </span>
                  <span className="mt-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-ink-3">
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label
                htmlFor="paid-watch-email"
                className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-ink-3"
              >
                Email for alerts
              </label>
              <input
                id="paid-watch-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 h-10 w-full border border-paper-rule bg-white px-3 font-[family-name:var(--font-mono)] text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-teal/30"
                disabled={state === "submitting"}
              />
            </div>

            <input
              type="text"
              name={HONEYPOT_FIELD}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              autoComplete="off"
            />

            <ul className="space-y-1.5 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-ink-2">
              <li>· Official inspection and license-record alerts (included)</li>
              <li>· Broader web mentions: news, enforcement, lawsuits, closures</li>
              <li>
                · Best-effort public review and complaint mentions we can find
                online
              </li>
              <li>· Source-linked alerts, usually within a day</li>
            </ul>

            <button
              type="submit"
              disabled={state === "submitting" || !email.trim()}
              className="h-11 w-full font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--color-teal)" }}
            >
              {state === "submitting" ? "Redirecting…" : "Continue to secure checkout →"}
            </button>

            {state === "error" && (
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-rust">
                {errorMsg}
              </p>
            )}

            <p className="font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-ink-4">
              Payment is processed by Stripe. Monitoring is activated within one
              business day. Cancel anytime from your billing link.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
