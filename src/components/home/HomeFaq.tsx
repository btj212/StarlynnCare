"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/content/homeFaqs";

interface HomeFaqProps {
  faqs: FaqItem[];
}

/**
 * Interactive FAQ accordion for the homepage § 06 section.
 * FAQ JSON-LD is emitted by the server parent (src/app/page.tsx) via buildFaqSchemaFromPairs.
 * Clearing visual: soft card stack; accordion behavior unchanged.
 */
export function HomeFaq({ faqs }: HomeFaqProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      {faqs.map((f, i) => {
        const isOpen = openIdx === i;
        return (
          <div
            key={i}
            className="cursor-pointer rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-4 py-5 shadow-[var(--shadow-card)] transition-colors hover:border-clearing-rule sm:grid sm:grid-cols-[52px_1fr] sm:gap-6 sm:px-5 sm:py-6"
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
            <span className="font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.1em] text-teal sm:pt-1">
              Q.{String(i + 1).padStart(2, "0")}
            </span>
            <div className="mt-2 min-w-0 sm:mt-0">
              <div className="flex items-start justify-between gap-3 font-[family-name:var(--font-display)] text-[19px] leading-[1.2] tracking-[-0.005em] text-ink sm:items-baseline sm:gap-6 sm:text-[24px]">
                <span className="min-w-0 pr-2">{f.q}</span>
                <span
                  className="shrink-0 pt-0.5 font-[family-name:var(--font-sans)] text-[20px] leading-none text-teal transition-transform sm:text-[22px]"
                  style={{ transform: isOpen ? "rotate(45deg)" : undefined }}
                  aria-hidden
                >
                  +
                </span>
              </div>
              {isOpen && (
                <p className="mt-3 max-w-[70ch] text-[15.5px] leading-[1.6] text-ink-2">
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
