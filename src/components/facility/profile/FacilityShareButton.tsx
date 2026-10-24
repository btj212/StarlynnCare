"use client";

import { useState } from "react";

export function FacilityShareButton({ facilityName }: { facilityName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    const payload = { title: facilityName, text: `${facilityName} — inspection record`, url };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="mt-3 block font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.08em] text-teal underline underline-offset-4"
    >
      {copied ? "Link copied" : "Share with family"}
    </button>
  );
}
