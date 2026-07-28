"use client";

import { PAID_WATCH_ANCHOR } from "@/lib/facility-watch/paidConfig";
import { emitPaidWatchAnchorClick } from "@/lib/analytics/clarityEvents";

/**
 * One-line early-page link that scrolls to the Premium checkout section.
 * Placed near quick facts so the offer is reachable inside a median ~95s
 * mobile session without a second popup/interstitial.
 */
export function FacilityWatchPremiumAnchor() {
  return (
    <div
      className="border-b border-clearing-rule px-4 py-3 sm:px-6 md:px-[60px]"
      style={{ backgroundColor: "var(--color-clearing-tint)" }}
    >
      <div className="mx-auto max-w-[1280px]">
        <a
          href={`#${PAID_WATCH_ANCHOR}`}
          onClick={() => emitPaidWatchAnchorClick()}
          className="font-[family-name:var(--font-sans)] text-[13px] font-medium tracking-[0.02em] text-teal underline-offset-4 hover:underline"
        >
          Get alerts if this facility&apos;s record changes →
        </a>
      </div>
    </div>
  );
}
