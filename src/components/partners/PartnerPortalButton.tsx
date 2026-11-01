"use client";

import { useState } from "react";

export function PartnerPortalButton({ token }: { token: string }) {
  const [message, setMessage] = useState("");

  async function openPortal() {
    setMessage("");
    const res = await fetch("/api/partners/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json()) as { url?: string; error?: string };
    if (body.url) {
      window.location.href = body.url;
      return;
    }
    setMessage(body.error ?? "The billing portal is unavailable.");
  }

  return (
    <div className="mt-6">
      <button type="button" onClick={openPortal} className="bg-ink px-4 py-2 text-sm text-paper">
        Open billing portal
      </button>
      {message ? <p className="mt-3 text-sm text-ink-2">{message}</p> : null}
    </div>
  );
}
