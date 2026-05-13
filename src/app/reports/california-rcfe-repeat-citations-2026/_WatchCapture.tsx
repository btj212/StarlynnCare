"use client";

import { useState } from "react";
import { submitWatch } from "@/lib/watch/submitWatch";

type FormState = "idle" | "submitting" | "success" | "error";

export function ReportWatchCapture() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setFormState("submitting");
    const result = await submitWatch({
      email: email.trim(),
      facilityId: "report-ca-rcfe-repeat-citations-2026",
      facilityName: "California RCFE Repeat Citations Report",
      source: "report_waitlist",
    });
    setFormState(result.ok ? "success" : "error");
  };

  if (formState === "success") {
    return (
      <p className="text-[15px] text-teal font-[family-name:var(--font-mono)] tracking-[0.02em]">
        ✓ You&rsquo;re on the list — we&rsquo;ll notify you when the full report publishes.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-[480px]">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 border border-paper-rule rounded px-4 py-2.5 text-[14px] text-ink bg-paper focus:outline-none focus:ring-2 focus:ring-teal/40"
        disabled={formState === "submitting"}
      />
      <button
        type="submit"
        disabled={formState === "submitting"}
        className="shrink-0 px-5 py-2.5 rounded bg-teal text-white text-[13.5px] font-medium tracking-[0.01em] hover:bg-teal-deep transition-colors disabled:opacity-60"
      >
        {formState === "submitting" ? "Sending…" : "Notify me"}
      </button>
      {formState === "error" && (
        <p className="text-[12px] text-rust mt-1 sm:mt-0 sm:self-center">
          Something went wrong — try again.
        </p>
      )}
    </form>
  );
}
