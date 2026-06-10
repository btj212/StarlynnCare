"use client";

import { useState, useEffect, useCallback } from "react";
import { submitWatch } from "@/lib/watch/submitWatch";

interface FacilityWatchModalProps {
  facilityId: string;
  facilityName: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

export function FacilityWatchModal({ facilityId, facilityName }: FacilityWatchModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const key = `watch-modal-seen-${facilityId}`;
    if (sessionStorage.getItem(key)) return;
    const timer = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(key, "1");
    }, 15000);
    return () => clearTimeout(timer);
  }, [facilityId]);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setFormState("submitting");
    setErrorMsg("");

    const result = await submitWatch({
      email: email.trim(),
      facilityId,
      facilityName,
      source: "modal",
    });

    if (result.ok) {
      setFormState("success");
      setTimeout(() => setOpen(false), 3000);
    } else {
      setErrorMsg(result.error ?? "Something went wrong. Try again.");
      setFormState("error");
    }
  };

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(26, 38, 32, 0.4)",
        animation: "fadeIn 200ms ease forwards",
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Facility Watch signup"
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Panel */}
      <div
        className="relative w-full max-w-[480px] p-8"
        style={{
          backgroundColor: "var(--color-paper)",
          animation: "slideUp 250ms ease forwards",
        }}
      >
        {/* Close — min 44×44 tap target */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center font-[family-name:var(--font-mono)] text-[18px] leading-none transition-opacity hover:opacity-70"
          style={{ color: "var(--color-ink-3)" }}
        >
          ×
        </button>

        {formState === "success" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-3xl" style={{ color: "var(--color-teal)" }}>✓</span>
            <p className="font-[family-name:var(--font-display)] text-[22px]" style={{ color: "var(--color-ink)" }}>
              You&apos;re on the list — we&apos;ll email you when anything changes.
            </p>
          </div>
        ) : (
          <>
            <h2
              className="font-[family-name:var(--font-display)] text-[28px] leading-tight mb-3"
              style={{ color: "var(--color-ink)" }}
            >
              This facility's record can change.
            </h2>
            <p
              className="font-[family-name:var(--font-display)] text-[18px] leading-snug mb-6"
              style={{ color: "var(--color-ink-2)", fontStyle: "italic" }}
            >
              Complaint investigations and new findings aren't announced. We'll tell you the moment the record updates.
            </p>

            <p
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--color-ink-3)" }}
            >
              FREE ALERT · NO ACCOUNT NEEDED
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
                {formState === "submitting" ? "Sending…" : `Watch ${facilityName} →`}
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
