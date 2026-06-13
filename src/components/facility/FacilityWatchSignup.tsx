"use client";

import { useState } from "react";
import { submitWatch } from "@/lib/watch/submitWatch";

interface FacilityWatchSignupProps {
  facilityId: string;
  facilityName: string;
  citationCount?: number;
}

type FormState = "idle" | "submitting" | "success" | "error";
type Intent = "research" | "touring" | "resident";

const INTENT_OPTIONS: { value: Intent; label: string }[] = [
  { value: "research", label: "Researching" },
  { value: "touring", label: "Touring soon" },
  { value: "resident", label: "They live here" },
];

export function FacilityWatchSignup({
  facilityId,
  facilityName,
  citationCount = 0,
}: FacilityWatchSignupProps) {
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState<Intent | undefined>(undefined);
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setState("submitting");
    setErrorMsg("");

    const result = await submitWatch({
      email: email.trim(),
      facilityId,
      facilityName,
      source: "inline_strip",
      intent,
    });

    if (result.ok) {
      setState("success");
    } else {
      setErrorMsg(result.error ?? "Something went wrong. Try again.");
      setState("error");
    }
  };

  const headline =
    citationCount > 0
      ? `${facilityName} has ${citationCount} citation${citationCount === 1 ? "" : "s"} on record. Know the moment anything changes.`
      : `Be first to know if ${facilityName}'s inspection record changes.`;

  return (
    <section
      className="w-full py-10 px-4 md:px-8"
      style={{ backgroundColor: "var(--color-teal)" }}
    >
      <div className="mx-auto max-w-[1280px]">
        {state === "success" ? (
          <div className="flex items-center gap-3">
            <span className="text-white text-xl">✓</span>
            <p className="font-[family-name:var(--font-mono)] text-[13px] tracking-[0.06em] text-white">
              You&apos;re on the list — we&apos;ll email you when anything changes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-12">
            {/* Copy */}
            <div className="md:flex-1">
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                FACILITY WATCH · FREE
              </p>
              <p className="font-[family-name:var(--font-display)] text-[26px] leading-snug text-white md:text-[30px]">
                {headline}
              </p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em]" style={{ color: "rgba(255,255,255,0.7)" }}>
                New findings, complaint investigations, or status changes — emailed to you free.
              </p>
            </div>

            {/* Form */}
            <div className="md:flex-shrink-0 flex flex-col gap-4">
              {/* Optional intent selector */}
              <div>
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Where are you in the process? <span style={{ color: "rgba(255,255,255,0.4)" }}>(optional)</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {INTENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIntent(intent === opt.value ? undefined : opt.value)}
                      className="px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] border transition-colors"
                      style={{
                        borderColor: intent === opt.value ? "white" : "rgba(255,255,255,0.35)",
                        backgroundColor: intent === opt.value ? "white" : "transparent",
                        color: intent === opt.value ? "var(--color-teal)" : "rgba(255,255,255,0.85)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="watch-inline-email"
                    className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    Email address
                  </label>
                  <input
                    id="watch-inline-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10 w-full min-w-[240px] border-0 bg-white px-3 font-[family-name:var(--font-mono)] text-[13px] focus:outline-none focus:ring-2 focus:ring-white/50"
                    style={{ color: "var(--color-ink)" }}
                    disabled={state === "submitting"}
                  />
                </div>
                <button
                  type="submit"
                  disabled={state === "submitting" || !email.trim()}
                  className="h-10 px-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-teal-deep)" }}
                >
                  {state === "submitting" ? "Sending…" : "Watch Free →"}
                </button>
              </form>

              {state === "error" && (
                <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em]" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {errorMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
