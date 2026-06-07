"use client";

import Link from "next/link";
import { useShortlist } from "@/lib/shortlist/context";

/**
 * Sticky bottom bar that appears when the shortlist has ≥1 item.
 * Provides a persistent anchor into the /shortlist compare view.
 */
export function ShortlistBar() {
  const { items } = useShortlist();
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-4 px-4 pointer-events-none">
      <Link
        href="/shortlist"
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-ink/20 bg-ink px-5 py-3 shadow-xl text-paper no-underline hover:bg-ink-2 transition-colors"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5Z" />
        </svg>
        <span className="font-[family-name:var(--font-sans)] font-semibold text-sm">
          Shortlist{" "}
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-teal text-ink font-bold text-[11px] px-1.5 ml-0.5">
            {items.length}
          </span>
        </span>
        <span className="font-[family-name:var(--font-sans)] text-sm text-paper/70">
          Compare &amp; email reports →
        </span>
      </Link>
    </div>
  );
}
