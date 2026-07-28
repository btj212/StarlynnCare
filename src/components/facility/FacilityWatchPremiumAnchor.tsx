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
      className="border-b border-paper-rule px-4 py-3 md:px-8"
      style={{ backgroundColor: "var(--color-paper-2)" }}
    >
      <div className="mx-auto max-w-[1280px]">
        <a
          href={`#${PAID_WATCH_ANCHOR}`}
          onClick={() => emitPaidWatchAnchorClick()}
          className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] text-teal hover:underline underline-offset-4"
        >
          Get alerts if this facility&apos;s record changes →
        </a>
      </div>
    </div>
  );
}
