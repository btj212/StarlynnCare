"use client";

import { useState, useEffect } from "react";
import { submitWatch } from "@/lib/watch/submitWatch";

interface FacilityWatchBarProps {
  facilityId: string;
  facilityName: string;
}

type FormState = "idle" | "submitting" | "success" | "error";
type Intent = "research" | "touring" | "resident";

const INTENT_OPTIONS: { value: Intent; label: string }[] = [
  { value: "research", label: "Researching" },
  { value: "touring", label: "Touring soon" },
  { value: "resident", label: "They live here" },
];

export function FacilityWatchBar({ facilityId, facilityName }: FacilityWatchBarProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState<Intent | undefined>(undefined);
  const [formState, setFormState] = useState<FormState>("idle");

  useEffect(() => {
    if (sessionStorage.getItem(`watch-bar-dismissed-${facilityId}`)) {
      setDismissed(true);
      return;
    }

    const onScroll = () => {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (pct >= 0.6) setVisible(true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [facilityId]);

  const handleDismiss = () => {
    sessionStorage.setItem(`watch-bar-dismissed-${facilityId}`, "1");
    setDismissed(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setFormState("submitting");

    const result = await submitWatch({
      email: email.trim(),
      facilityId,
      facilityName,
      source: "sticky_bar",
      intent,
    });

    if (result.ok) {
      setFormState("success");
      setTimeout(() => setDismissed(true), 2500);
    } else {
      setFormState("error");
    }
  };

  if (dismissed) return null;

  const shortName = facilityName.length > 30 ? facilityName.slice(0, 30) + "…" : facilityName;

  return (
    <div
      role="complementary"
      aria-label="Facility Watch signup"
      className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300"
      style={{
        backgroundColor: "var(--color-ink)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
      }}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3 md:px-8 md:py-0 md:h-16">
        {formState === "success" ? (
          <p className="flex-1 font-[family-name:var(--font-mono)] text-[12px] tracking-[0.06em] text-white">
            ✓ You&apos;re on the list — we&apos;ll email you when anything changes.
          </p>
        ) : (
          <>
            {/* Label */}
            <div className="flex-1 min-w-0">
              {!expanded ? (
                <button
                  onClick={() => setExpanded(true)}
                  className="min-h-[44px] text-left font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] text-white/80 hover:text-white transition-colors md:cursor-default"
                >
                  <span className="md:hidden">This record can change. Get notified →</span>
                  <span className="hidden md:inline">This record can change. We&rsquo;ll tell you when it does →</span>
                </button>
              ) : (
                /* Mobile expanded: intent pills + form */
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {INTENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIntent(intent === opt.value ? undefined : opt.value)}
                        className="px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.05em] border transition-colors"
                        style={{
                          borderColor: intent === opt.value ? "white" : "rgba(255,255,255,0.3)",
                          backgroundColor: intent === opt.value ? "white" : "transparent",
                          color: intent === opt.value ? "var(--color-ink)" : "rgba(255,255,255,0.75)",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="h-11 w-full max-w-[220px] border-0 bg-white/10 px-3 font-[family-name:var(--font-mono)] text-[12px] text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none"
                      disabled={formState === "submitting"}
                    />
                    <button
                      type="submit"
                      disabled={formState === "submitting" || !email.trim()}
                      className="h-11 px-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "var(--color-teal)" }}
                    >
                      {formState === "submitting" ? "…" : "Watch →"}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Desktop: intent pills + inline form (always visible on md+) */}
            {!expanded && (
              <div className="hidden md:flex items-center gap-3">
                <div className="flex gap-1.5">
                  {INTENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIntent(intent === opt.value ? undefined : opt.value)}
                      className="px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.05em] border transition-colors"
                      style={{
                        borderColor: intent === opt.value ? "white" : "rgba(255,255,255,0.3)",
                        backgroundColor: intent === opt.value ? "white" : "transparent",
                        color: intent === opt.value ? "var(--color-ink)" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="h-11 w-[220px] border-0 bg-white/10 px-3 font-[family-name:var(--font-mono)] text-[12px] text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none"
                    disabled={formState === "submitting"}
                  />
                  <button
                    type="submit"
                    disabled={formState === "submitting" || !email.trim()}
                    className="h-11 px-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-teal)" }}
                  >
                    {formState === "submitting" ? "…" : "Watch Free →"}
                  </button>
                </form>
              </div>
            )}

            {formState === "error" && (
              <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.04em] text-white/70">
                Something went wrong — try again.
              </p>
            )}
          </>
        )}

        {/* Dismiss — min 44×44 tap target */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="ml-2 flex h-11 w-11 flex-shrink-0 self-start md:self-auto items-center justify-center font-[family-name:var(--font-mono)] text-[18px] leading-none transition-opacity hover:opacity-100"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
