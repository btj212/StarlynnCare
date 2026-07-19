"use client";

import { useEffect, useState } from "react";
import { FadeUp } from "@/components/FadeUp";
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
    const focusFromHash = () => {
      if (window.location.hash !== `#${PAID_WATCH_ANCHOR}`) return;
      const el = document.getElementById(PAID_WATCH_ANCHOR);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("paid-watch-email")?.focus({ preventScroll: true });
    };
    focusFromHash();
    window.addEventListener("hashchange", focusFromHash);
    return () => window.removeEventListener("hashchange", focusFromHash);
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
      <FadeUp>
        <div
          className="mx-auto max-w-[1280px] overflow-hidden rounded-sm bg-ink text-paper"
        >
          <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
            {/* Left: pitch */}
            <div className="border-b border-white/10 px-6 py-8 md:border-b-0 md:border-r md:px-8 md:py-10">
              <p className="mb-3 flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-gold">
                <span className="live-dot" aria-hidden />
                Facility Watch · Premium
              </p>

              <p className="mb-4 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-paper/55">
                Monitoring available · {facilityName}
              </p>

              <h2 className="max-w-[22ch] font-[family-name:var(--font-display)] text-[28px] leading-[1.15] tracking-[-0.01em] text-paper md:text-[34px]">
                Someone should be{" "}
                <em className="not-italic text-gold-soft">watching.</em>
              </h2>

              <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-paper/75">
                We monitor news, public reviews, and complaint mentions we can
                find across the web — plus official inspection and license-record
                changes for {facilityName} — and flag anything material to you,
                usually within a day of it appearing online. Nothing is swept
                under the rug.
              </p>

              <ul className="mt-6 space-y-2 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-paper/70">
                <li className="flex gap-2">
                  <span className="text-gold" aria-hidden>
                    ·
                  </span>
                  <span>Official inspection and license-record alerts (included)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold" aria-hidden>
                    ·
                  </span>
                  <span>Broader web mentions: news, enforcement, lawsuits, closures</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold" aria-hidden>
                    ·
                  </span>
                  <span>
                    Best-effort public review and complaint mentions we can find
                    online
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold" aria-hidden>
                    ·
                  </span>
                  <span>Source-linked alerts, usually within a day</span>
                </li>
              </ul>

              <p className="mt-6 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-paper/45">
                ${PAID_WATCH_MONTHLY_USD}/month or ${PAID_WATCH_ANNUAL_USD}/year ·
                Cancel anytime
              </p>
            </div>

            {/* Right: always-visible checkout card */}
            <form
              onSubmit={startCheckout}
              className="flex flex-col justify-center bg-ink px-6 py-8 md:px-7 md:py-10"
              style={{ backgroundColor: "color-mix(in srgb, var(--color-ink) 92%, white)" }}
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
                ).map((opt) => {
                  const selected = interval === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectPlan(opt.value)}
                      className="border px-3 py-3 text-left transition-colors"
                      style={{
                        borderColor: selected
                          ? "var(--color-gold)"
                          : "rgba(255,255,255,0.14)",
                        backgroundColor: selected
                          ? "color-mix(in srgb, var(--color-gold) 14%, transparent)"
                          : "transparent",
                      }}
                    >
                      <span className="block font-[family-name:var(--font-mono)] text-[12px] tracking-[0.06em] text-paper">
                        {opt.label}
                      </span>
                      <span className="mt-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-paper/50">
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="paid-watch-email"
                  className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-paper/50"
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
                  className="mt-1 h-11 w-full border border-white/15 bg-white/95 px-3 font-[family-name:var(--font-mono)] text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-gold/40"
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

              <button
                type="submit"
                disabled={state === "submitting" || !email.trim()}
                className="mt-5 h-12 w-full font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "var(--color-gold)" }}
              >
                {state === "submitting"
                  ? "Redirecting…"
                  : "Continue to secure checkout →"}
              </button>

              {state === "error" && (
                <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] text-rust">
                  {errorMsg}
                </p>
              )}

              <p className="mt-4 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-paper/40">
                Payment is processed by Stripe. Monitoring is activated within
                one business day. Cancel anytime from your billing link.
              </p>
            </form>
          </div>
        </div>
      </FadeUp>
    </section>
  );
}
