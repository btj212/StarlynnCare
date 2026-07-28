"use client";

import { useState, useEffect } from "react";
import { useOffer } from "@/components/facility/offer/FacilityOfferProvider";

/**
 * Mobile fixed bottom bar — surfaces the assigned offer CTA once the visitor
 * has scrolled 60% of the page. On click it delegates to the shared
 * FacilityOfferProvider trigger (scrolls to Premium, opens modal, or routes).
 */
export function FacilityOfferBar() {
  const { offer, facilityId, triggerOffer } = useOffer();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(`offer-bar-dismissed-${facilityId}`)) {
      setDismissed(true);
      return;
    }

    const onScroll = () => {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (pct >= 0.6) setVisible(true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [facilityId]);

  const handleDismiss = () => {
    sessionStorage.setItem(`offer-bar-dismissed-${facilityId}`, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      role="complementary"
      aria-label="Facility offer"
      className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300"
      style={{
        backgroundColor: "var(--color-ink)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
      }}
    >
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 sm:px-6 md:px-[60px]">
        {/* Eyebrow + action — offer wiring unchanged */}
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.12em] leading-none text-gold/70">
            {offer.eyebrow}
          </p>
          <button
            type="button"
            onClick={triggerOffer}
            className="rounded-xl bg-teal px-3.5 py-2 text-left font-[family-name:var(--font-sans)] text-[13px] font-semibold tracking-[0.01em] text-white transition-colors hover:bg-teal-deep"
          >
            {offer.ctaLabel}
          </button>
        </div>

        {/* Dismiss — 44×44 tap target */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center font-[family-name:var(--font-mono)] text-[18px] leading-none transition-opacity hover:opacity-100"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
