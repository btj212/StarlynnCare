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
 * Stat grid for homepage / hub pages.
 * Clearing visual: soft white cards; same StatItem API and sources.
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
      <div className={`grid grid-cols-1 gap-3.5 ${wide}`}>
        {stats.map((s, i) => (
          <div
            key={i}
            className={`relative rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-4 py-7 shadow-[var(--shadow-card)] sm:px-6 sm:py-8 md:px-7 md:py-9${
              stats.length === 3 && i === stats.length - 1 ? " sm:col-span-2 lg:col-span-1" : ""
            }`}
          >
            <span className="absolute top-3.5 right-4 font-[family-name:var(--font-sans)] text-[11px] font-medium uppercase tracking-[0.08em] text-ink-4">
              [{String(i + 1).padStart(2, "0")}] {s.src}
            </span>

            <div
              className={`font-[family-name:var(--font-display)] tracking-[-0.02em] text-ink${
                compact
                  ? " break-words text-[clamp(28px,3.5vw,44px)] leading-[1.0]"
                  : " text-[clamp(40px,5vw,52px)] leading-[0.95]"
              }`}
            >
              {s.n}
              {s.unit && (
                <span className="ml-1.5 text-[0.55em] text-ink-3">{s.unit}</span>
              )}
            </div>

            <p className="mt-3.5 max-w-none text-[14px] leading-[1.4] text-ink-2 sm:max-w-[26ch] sm:text-[14.5px]">
              {s.label}
            </p>

            {s.delta && (
              <span className="mt-3 inline-block font-[family-name:var(--font-sans)] text-[12px] font-medium tracking-[0.04em] text-teal">
                ↑ {s.delta}
              </span>
            )}
          </div>
        ))}
      </div>

      {footnotes && footnotes.length > 0 && (
        <div className="mt-5 flex flex-col gap-2 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-3 sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-2 sm:text-[13px]">
          {footnotes.map((f, i) => (
            <span key={i} className="before:mr-1 before:text-teal before:content-['▸']">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
