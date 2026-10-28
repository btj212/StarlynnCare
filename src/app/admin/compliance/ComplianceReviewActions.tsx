"use client";

import { useState } from "react";

export function ComplianceReviewActions({ facilityId }: { facilityId: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "approve" | "hold") {
    setPending(action);
    setError(null);
    const response = await fetch("/api/admin/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, action }),
    });
    if (!response.ok) {
      setError("Could not save that decision.");
      setPending(null);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => send("approve")}
        disabled={pending !== null}
        className="rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {pending === "approve" ? "Saving…" : "Approve banner"}
      </button>
      <button
        type="button"
        onClick={() => send("hold")}
        disabled={pending !== null}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {pending === "hold" ? "Saving…" : "Hold"}
      </button>
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </div>
  );
}
