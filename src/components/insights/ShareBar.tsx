"use client";

import { useState } from "react";

interface ShareBarProps {
  url: string;
  title: string;
}

/**
 * Minimal share affordance: X (Twitter), Reddit, and copy-link.
 * All links open in a new tab.
 */
export function ShareBar({ url, title }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const xHref = `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`;
  const redditHref = `https://www.reddit.com/submit?url=${encoded}&title=${encodedTitle}`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="flex items-center gap-4 flex-wrap mt-6 mb-2">
      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
        Share
      </span>
      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-teal hover:text-teal/70 transition-colors"
        aria-label="Share on X (Twitter)"
      >
        X / Twitter
      </a>
      <a
        href={redditHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-teal hover:text-teal/70 transition-colors"
        aria-label="Share on Reddit"
      >
        Reddit
      </a>
      <button
        onClick={handleCopy}
        className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-teal hover:text-teal/70 transition-colors cursor-pointer"
        aria-label="Copy article link to clipboard"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
