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
            className="border-b border-paper-rule py-6 grid gap-6 cursor-pointer hover:bg-paper-2 transition-colors px-0 hover:px-3"
            style={{ gridTemplateColumns: "60px 1fr" }}
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
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-rust tracking-[0.1em] uppercase">
              Q.{String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="flex justify-between items-baseline gap-6 font-[family-name:var(--font-display)] text-[24px] leading-[1.2] tracking-[-0.005em] text-ink">
                <span>{f.q}</span>
                <span
                  className="font-[family-name:var(--font-sans)] text-[22px] text-rust shrink-0 transition-transform"
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
