"use client";

import { useState } from "react";

export function BillingPortalButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const openPortal = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/facility-watch/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not open billing portal.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="h-11 px-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--color-ink)" }}
      >
        {loading ? "Opening…" : "Update payment or cancel →"}
      </button>
      {error && (
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] text-rust">
          {error}
        </p>
      )}
    </div>
  );
}
