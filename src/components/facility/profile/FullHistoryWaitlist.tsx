"use client";

import { useState } from "react";
import { submitWatch } from "@/lib/watch/submitWatch";

export function FullHistoryWaitlist({
  facilityId,
  facilityName,
  hiddenCount,
  oldestYear,
}: {
  facilityId: string;
  facilityName: string;
  hiddenCount: number;
  oldestYear: number;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    const result = await submitWatch({
      email: email.trim(),
      facilityId,
      facilityName,
      source: "records_pull_interest",
      intent: "research",
    });
    if (result.ok) {
      setStatus("done");
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="mt-6 rounded border border-paper-rule bg-paper-2 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-wide">
            <span className="text-ink-2 font-semibold">
              {hiddenCount} older inspection{hiddenCount === 1 ? "" : "s"}
            </span>
            {" "}from {oldestYear} are not shown above.
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-teal tracking-wide">
            Get the complete record, translated into plain language — emailed to you.
          </p>
        </div>

        {status === "done" ? (
          <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-teal-deep whitespace-nowrap shrink-0">
            ✓ On the list — we&apos;ll send the full record to your inbox.
          </span>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "submitting"}
              className="font-[family-name:var(--font-mono)] text-[11px] border border-paper-rule bg-paper rounded px-2.5 py-1.5 w-44 placeholder:text-ink-4 focus:outline-none focus:border-teal disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.07em] bg-teal text-white px-3 py-1.5 rounded hover:bg-teal-deep transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {status === "submitting" ? "Sending…" : "Get full record"}
            </button>
          </form>
        )}
      </div>
      {status === "error" && (
        <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[10px] text-rust">{errorMsg}</p>
      )}
    </div>
  );
}
