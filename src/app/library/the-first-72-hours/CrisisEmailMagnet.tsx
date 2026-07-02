"use client";

import { useState } from "react";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD } from "@/lib/security/honeypot";

type State = "idle" | "submitting" | "done" | "error";

export function CrisisEmailMagnet() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("submitting");

    try {
      const res = await fetch("/api/watch/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: "crisis_playbook",
          journeyStage: "crisis",
          magnet: "crisis_checklist",
          [HONEYPOT_FIELD]: "",
          [HONEYPOT_TS_FIELD]: String(Date.now()),
        }),
      });
      if (res.ok) {
        setState("done");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div
      className="my-12 rounded px-6 py-8"
      style={{ backgroundColor: "var(--color-teal)" }}
    >
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
        Free · 72-hour placement checklist
      </p>
      <p className="font-[family-name:var(--font-display)] text-[24px] leading-snug text-white mb-2">
        Overwhelmed right now? Get the checklist.
      </p>
      <p className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>
        72-hour placement checklist + discharge rights one-pager — the exact steps, in order, with the questions to ask at each stage. Emailed immediately, free.
      </p>

      {state === "done" ? (
        <p className="font-[family-name:var(--font-mono)] text-[13px] tracking-[0.06em] text-white">
          ✓ Check your inbox — the checklist is on its way.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="crisis-magnet-email"
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Email address
            </label>
            <input
              id="crisis-magnet-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 min-w-[240px] border-0 bg-white px-3 font-[family-name:var(--font-mono)] text-[13px] focus:outline-none focus:ring-2 focus:ring-white/50"
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
            {state === "submitting" ? "Sending…" : "Send me the digest →"}
          </button>
        </form>
      )}

      {state === "error" && (
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "rgba(255,255,255,0.8)" }}>
          Something went wrong — please try again.
        </p>
      )}
    </div>
  );
}
