"use client";

import { useState, useEffect, useCallback } from "react";

interface AreaWatchModalProps {
  areaName: string;
  areaSlug: string;
  stateCode: string;
  source: "city_modal" | "state_modal";
  /** Milliseconds before the modal appears. Default: 15000 */
  delayMs?: number;
}

type FormState = "idle" | "submitting" | "success" | "error";

const COPY = {
  city_modal: {
    headline: (areaName: string) => `Searching for memory care in ${areaName}?`,
    sub: "Get a weekly digest when official inspection records change for facilities in this area — so you can compare before you pick one.",
    button: "Get the area digest →",
  },
  state_modal: {
    headline: (areaName: string) => `Researching memory care in ${areaName}?`,
    sub: "Get a weekly digest when official inspection records change across the state — useful while you are still narrowing cities.",
    button: "Get the area digest →",
  },
};

export function AreaWatchModal({
  areaName,
  areaSlug,
  stateCode,
  source,
  delayMs = 15000,
}: AreaWatchModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const prefix = source === "state_modal" ? "state" : "city";
    const key = `watch-modal-seen-${prefix}-${areaSlug}`;
    if (sessionStorage.getItem(key)) return;
    const timer = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(key, "1");
    }, delayMs);
    return () => clearTimeout(timer);
  }, [areaSlug, source, delayMs]);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setFormState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/watch/area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          areaName,
          areaSlug,
          stateCode,
          source,
        }),
      });

      if (res.ok) {
        setFormState("success");
        setTimeout(() => setOpen(false), 3000);
      } else {
        const json = await res.json().catch(() => ({}));
        setErrorMsg((json as { error?: string }).error ?? "Something went wrong. Try again.");
        setFormState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setFormState("error");
    }
  };

  if (!open) return null;

  const copy = COPY[source];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(26, 38, 32, 0.4)",
        animation: "fadeIn 200ms ease forwards",
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Area Watch signup"
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div
        className="relative w-full max-w-[480px] p-8"
        style={{
          backgroundColor: "var(--color-paper)",
          animation: "slideUp 250ms ease forwards",
        }}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-4 top-4 font-[family-name:var(--font-mono)] text-[18px] leading-none transition-opacity hover:opacity-70"
          style={{ color: "var(--color-ink-3)" }}
        >
          ×
        </button>

        {formState === "success" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-3xl" style={{ color: "var(--color-teal)" }}>✓</span>
            <p className="font-[family-name:var(--font-display)] text-[22px]" style={{ color: "var(--color-ink)" }}>
              You&rsquo;re watching {areaName}.
            </p>
          </div>
        ) : (
          <>
            <h2
              className="font-[family-name:var(--font-display)] text-[28px] leading-tight mb-3"
              style={{ color: "var(--color-ink)" }}
            >
              {copy.headline(areaName)}
            </h2>
            <p
              className="font-[family-name:var(--font-display)] text-[18px] leading-snug mb-6"
              style={{ color: "var(--color-ink-2)", fontStyle: "italic" }}
            >
              {copy.sub}
            </p>

            <p
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--color-ink-3)" }}
            >
              WEEKLY AREA DIGEST · NO ACCOUNT NEEDED
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-11 w-full border px-3 font-[family-name:var(--font-mono)] text-[13px] focus:outline-none focus:ring-2"
                style={{
                  borderColor: "var(--color-paper-rule)",
                  color: "var(--color-ink)",
                  backgroundColor: "white",
                }}
                disabled={formState === "submitting"}
              />
              <button
                type="submit"
                disabled={formState === "submitting" || !email.trim()}
                className="h-11 w-full font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "var(--color-teal)" }}
              >
                {formState === "submitting" ? "Sending…" : copy.button}
              </button>
            </form>

            {formState === "error" && (
              <p
                className="mt-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em]"
                style={{ color: "var(--color-rust)" }}
              >
                {errorMsg}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
