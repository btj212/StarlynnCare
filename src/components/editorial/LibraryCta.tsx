import Link from "next/link";

interface LibraryCtaProps {
  /**
   * State slug for the browse link (defaults to "california").
   * Used to generate the "Browse X facilities" CTA.
   */
  stateSlug?: string;
  /** Human-readable state name (defaults to "California"). */
  stateName?: string;
  /** Override the hub URL when a specific city/county hub is more relevant. */
  hubHref?: string;
  hubLabel?: string;
}

/**
 * End-of-article CTA block for library guides.
 * Surfaces two onward paths: browse inspections by area, and the shortlist/compare tool.
 * Addresses the audit finding that high-dwell guides (5–24 min sessions) are 100% dead-ends.
 */
export function LibraryCta({
  stateSlug = "california",
  stateName = "California",
  hubHref,
  hubLabel,
}: LibraryCtaProps) {
  const browseHref = hubHref ?? `/${stateSlug}/facilities`;
  const browseLabel = hubLabel ?? `Browse ${stateName} memory care facilities →`;

  return (
    <div className="mt-14 rounded-2xl border border-paper-rule bg-paper-2 overflow-hidden">
      {/* Top band */}
      <div className="border-b border-paper-rule px-8 py-7">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust mb-3">
          Next step
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,32px)] font-normal leading-[1.15] tracking-[-0.01em] text-ink">
          Find a facility — ranked by inspection record,{" "}
          <em>not referral commission.</em>
        </h2>
        <p className="mt-3 text-[16px] text-ink-2 leading-[1.6] max-w-[60ch]">
          Every facility on StarlynnCare is paired with its state inspection history —
          citation counts, deficiency class, and recency. The data incumbents won&apos;t show you
          because they earn a referral fee when you pick one.
        </p>
      </div>

      {/* CTA buttons */}
      <div className="px-8 py-6 flex flex-wrap gap-4">
        <Link
          href={browseHref}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper no-underline hover:bg-ink-2 transition-colors"
        >
          {browseLabel}
        </Link>
        <Link
          href="/shortlist"
          className="inline-flex items-center gap-2 rounded-full border border-paper-rule bg-white px-5 py-3 text-sm font-semibold text-ink-2 no-underline hover:border-teal/40 hover:text-teal-deep transition-colors"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5Z" />
          </svg>
          Build your shortlist
        </Link>
      </div>

      {/* Footnote */}
      <div className="border-t border-paper-rule px-8 py-4 bg-paper">
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4">
          Free · No referral commissions · Data sourced from state regulator inspection records
        </p>
      </div>
    </div>
  );
}
