"use client";

import { useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

/**
 * Inline email capture for the Medi-Cal/ALW article.
 * Signs up to the digest_subscriber list with source "alw_article".
 */
export function AlwEmailCapture() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setState("submitting");
    try {
      const res = await fetch("/api/watch/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "alw_article", stateCode: "CA", magnet: "alw_checklist" }),
      });
      setState(res.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-lg border border-teal/30 bg-teal/5 px-5 py-4 text-[15px] text-teal">
        You&rsquo;re on the list — we&rsquo;ll send the Medi-Cal/ALW checklist to your inbox.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
        Free resource
      </p>
      <p className="font-[family-name:var(--font-display)] text-[18px] text-ink leading-snug mb-1">
        Get the Medi-Cal / ALW checklist
      </p>
      <p className="text-[14px] text-ink-3 mb-4">
        County participation, waitlist steps, SSI room-and-board rates, and the
        facility questions to ask — in one printable reference.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={state === "submitting"}
          className="flex-1 rounded-lg border border-paper-rule bg-paper px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="rounded-lg bg-ink px-5 py-2.5 text-[14px] font-semibold text-paper hover:bg-ink/90 transition disabled:opacity-60 whitespace-nowrap"
        >
          {state === "submitting" ? "Sending…" : "Send checklist"}
        </button>
      </form>
      {state === "error" && (
        <p className="mt-2 text-[13px] text-rust">Something went wrong — please try again.</p>
      )}
      <p className="mt-3 text-[11px] font-[family-name:var(--font-mono)] text-ink-4">
        No spam · Unsubscribe any time
      </p>
    </div>
  );
}
