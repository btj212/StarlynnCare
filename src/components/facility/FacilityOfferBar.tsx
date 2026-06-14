"use client";

import { useState, useEffect } from "react";
import { useOffer } from "@/components/facility/offer/FacilityOfferProvider";

/**
 * Mobile fixed bottom bar — surfaces the assigned offer CTA once the visitor
 * has scrolled 60% of the page. On click it delegates to the shared
 * FacilityOfferProvider trigger (opens modal or routes).
 *
 * For the "watch" variant the bar matches the old FacilityWatchBar UX.
 * For all other variants it shows the offer label and opens the modal.
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
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3">
        {/* Eyebrow + action */}
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-gold/70 leading-none mb-1">
            {offer.eyebrow}
          </p>
          <button
            type="button"
            onClick={triggerOffer}
            className="text-left font-[family-name:var(--font-mono)] text-[12.5px] tracking-[0.04em] text-white hover:text-gold transition-colors"
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
