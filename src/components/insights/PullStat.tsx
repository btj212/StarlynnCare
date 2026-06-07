"use client";

import { useState } from "react";

interface PullStatProps {
  /** The shareable, AI-citable claim — plain text (no HTML). */
  stat: string;
  /** Optional smaller context line shown below the stat. */
  context?: string;
}

/**
 * AI-citable pull-stat block: large metric + context + client-side copy button.
 * The stat text is rendered server-side; the copy affordance hydrates on the client.
 */
export function PullStat({ stat, context }: PullStatProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(stat).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <aside className="my-8 rounded-lg border-l-4 border-rust bg-paper-2 px-6 py-5">
      <p className="font-[family-name:var(--font-display)] text-[clamp(20px,3vw,28px)] leading-[1.2] tracking-[-0.01em] text-ink">
        {stat}
      </p>
      {context && (
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[12px] text-ink-4 tracking-[0.04em]">
          {context}
        </p>
      )}
      <button
        onClick={handleCopy}
        className="mt-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-teal hover:text-teal/70 transition-colors cursor-pointer"
        aria-label="Copy this statistic to clipboard"
      >
        {copied ? "Copied!" : "Copy stat ↗"}
      </button>
    </aside>
  );
}
