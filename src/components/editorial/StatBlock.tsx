export interface StatItem {
  /** Big display number, e.g. "1,247" */
  n: string;
  /** Optional small unit appended after the number, e.g. "facilities" */
  unit?: string;
  /** Descriptive label below the number */
  label: string;
  /** Source citation, e.g. "CDSS" */
  src: string;
  /** Optional change indicator, e.g. "+18 since March" */
  delta?: string;
}

interface StatBlockProps {
  stats: StatItem[];
  footnotes?: string[];
  /**
   * Use a smaller, line-wrap-friendly font size for the number.
   * Good when `n` is a long string like "$8,000–$12,000".
   */
  compact?: boolean;
}

/**
 * Broadsheet 4-up stat grid with thin-rule dividers and footnote citations.
 * Used on homepage, county hub, and city hub pages.
 */
export function StatBlock({ stats, footnotes, compact = false }: StatBlockProps) {
  const wide =
    stats.length <= 1
      ? ""
      : stats.length === 2
        ? "sm:grid-cols-2"
        : stats.length === 3
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div>
      <div className={`grid grid-cols-1 gap-px bg-paper-rule border-t-2 border-b-2 border-ink ${wide}`}>
        {stats.map((s, i) => (
          <div
            key={i}
            className={`relative bg-paper-2 px-4 py-7 sm:px-6 sm:py-8 md:px-7 md:py-9${
              stats.length === 3 && i === stats.length - 1 ? " sm:col-span-2 lg:col-span-1" : ""
            }`}
          >
            {/* Source citation — top-right */}
            <span className="absolute top-3.5 right-4 font-[family-name:var(--font-mono)] text-[10px] text-ink-4 tracking-[0.08em] uppercase">
              [{String(i + 1).padStart(2, "0")}] {s.src}
            </span>

            {/* Big number */}
            <div
              className={`font-[family-name:var(--font-display)] leading-[1.0] tracking-[-0.02em] text-ink${
                compact
                  ? " text-[clamp(28px,3.5vw,44px)] break-words"
                  : " text-[clamp(48px,5.5vw,78px)] leading-[0.95]"
              }`}
            >
              {s.n}
              {s.unit && (
                <span className="text-[0.55em] text-ink-3 ml-1.5">{s.unit}</span>
              )}
            </div>

            {/* Label */}
            <p className="mt-3.5 text-[14px] sm:text-[14.5px] leading-[1.4] text-ink-2 max-w-none sm:max-w-[26ch]">
              {s.label}
            </p>

            {/* Delta */}
            {s.delta && (
              <span className="inline-block mt-3 font-[family-name:var(--font-mono)] text-[11px] text-rust tracking-[0.06em]">
                ↑ {s.delta}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footnote row */}
      {footnotes && footnotes.length > 0 && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-2 font-[family-name:var(--font-mono)] text-[11px] sm:text-[11.5px] text-ink-3 tracking-[0.04em]">
          {footnotes.map((f, i) => (
            <span key={i} className="before:content-['▸_'] before:text-rust">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
