"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/content/homeFaqs";

export function MobileHomeFaq({ faqs }: { faqs: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="m-faq">
      {faqs.map((f, i) => {
        const open = openIdx === i;
        return (
          <div
            key={i}
            className={`m-faq-item${open ? " open" : ""}`}
            onClick={() => setOpenIdx(open ? null : i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenIdx(open ? null : i);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={open}
          >
            <div className="m-faq-q">
              <span>{f.q}</span>
              <span className="plus" aria-hidden>
                +
              </span>
            </div>
            <div className="m-faq-a">{f.a}</div>
          </div>
        );
      })}
    </div>
  );
}
