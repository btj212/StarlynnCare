"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/content/homeFaqs";

interface HomeFaqProps {
  faqs: FaqItem[];
}

/**
 * Interactive FAQ accordion for the homepage § 06 section.
 * FAQ JSON-LD is emitted by the server parent (src/app/page.tsx) via buildFaqSchemaFromPairs.
 */
export function HomeFaq({ faqs }: HomeFaqProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="border-t-2 border-ink">
      {faqs.map((f, i) => {
        const isOpen = openIdx === i;
        return (
          <div
            key={i}
            className="border-b border-paper-rule py-5 sm:py-6 grid grid-cols-1 gap-3 sm:grid-cols-[52px_1fr] sm:gap-6 cursor-pointer hover:bg-paper-2 transition-colors px-0 sm:hover:px-3"
            onClick={() => setOpenIdx(isOpen ? null : i)}
            role="button"
            aria-expanded={isOpen}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenIdx(isOpen ? null : i);
              }
            }}
          >
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-rust tracking-[0.1em] uppercase sm:pt-1">
              Q.{String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex justify-between items-start gap-3 sm:items-baseline sm:gap-6 font-[family-name:var(--font-display)] text-[19px] sm:text-[24px] leading-[1.2] tracking-[-0.005em] text-ink">
                <span className="min-w-0 pr-2">{f.q}</span>
                <span
                  className="font-[family-name:var(--font-sans)] text-[20px] sm:text-[22px] text-rust shrink-0 transition-transform leading-none pt-0.5"
                  style={{ transform: isOpen ? "rotate(45deg)" : undefined }}
                  aria-hidden
                >
                  +
                </span>
              </div>
              {isOpen && (
                <p className="mt-3 text-[15.5px] leading-[1.6] text-ink-2 max-w-[70ch]">
                  {f.a}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
