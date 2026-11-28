"use client";

import { useState, type ReactNode } from "react";

export const VISIBLE_VISITS = 25;

/** Newest visits stay in the page. The rest render only after this control. */
export function OlderVisits({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count <= 0) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 border-b border-rust pb-px font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.06em] text-rust"
      >
        Show {count} older {count === 1 ? "visit" : "visits"}
      </button>
    );
  }
  return <>{children}</>;
}
