"use client";

import Link from "next/link";
import { ShortlistButton } from "@/components/shortlist/ShortlistButton";
import type { ShortlistItem } from "@/lib/shortlist/context";

export const CATEGORY_LABEL: Record<string, string> = {
  rcfe_memory_care: "RCFE · Memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory care",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home · Dementia SCU",
  ccrc: "CCRC",
};

export function TrustBadge({ item }: { item: ShortlistItem }) {
  if (item.inspections === 0) {
    return <span className="text-xs text-ink-4">No inspection data yet</span>;
  }
  if (item.serious_citations > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        {item.serious_citations} serious citation{item.serious_citations !== 1 ? "s" : ""} on file
      </span>
    );
  }
  if (item.total_citations > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        {item.total_citations} citation{item.total_citations !== 1 ? "s" : ""} on file
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4a7a50]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#6b8f71] shrink-0" />
      No citations on file
    </span>
  );
}

export function CompareCard({ item }: { item: ShortlistItem }) {
  return (
    <div className="flex flex-col rounded-xl border border-paper-rule bg-paper-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-paper-rule">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/${item.state_slug}/${item.city_slug}/${item.slug}`}
            className="font-[family-name:var(--font-display)] text-[18px] leading-snug text-ink hover:text-teal transition-colors"
          >
            {item.name}
          </Link>
          <ShortlistButton item={item} size="sm" />
        </div>
        {item.city && (
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 uppercase tracking-[0.06em]">
            {item.city}
          </p>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">Trust signal</span>
          <TrustBadge item={item} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">Total citations</span>
          <span className="font-[family-name:var(--font-mono)] font-semibold text-ink tabular-nums">
            {item.total_citations}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">Inspections on file</span>
          <span className="font-[family-name:var(--font-mono)] font-semibold text-ink tabular-nums">
            {item.inspections}
          </span>
        </div>
        {item.beds != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-3">Beds</span>
            <span className="font-[family-name:var(--font-mono)] font-semibold text-ink tabular-nums">
              {item.beds}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">License type</span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
            {CATEGORY_LABEL[item.care_category] ?? item.care_category}
          </span>
        </div>
      </div>

      <div className="mt-auto px-5 py-4 border-t border-paper-rule">
        <Link
          href={`/${item.state_slug}/${item.city_slug}/${item.slug}`}
          className="block w-full rounded-lg border border-teal/30 bg-teal/5 px-3 py-2.5 text-center text-sm font-semibold text-teal-deep hover:bg-teal/10 transition-colors"
        >
          View full inspection record →
        </Link>
      </div>
    </div>
  );
}
