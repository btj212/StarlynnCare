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
}

/**
 * Broadsheet 4-up stat grid with thin-rule dividers and footnote citations.
 * Used on homepage, county hub, and city hub pages.
 */
export function StatBlock({ stats, footnotes }: StatBlockProps) {
  return (
    <div>
      <div
        className="grid border-t-2 border-b-2 border-ink"
        style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            className="relative px-7 py-9 border-r border-paper-rule last:border-r-0"
          >
            {/* Source citation — top-right */}
            <span className="absolute top-3.5 right-4 font-[family-name:var(--font-mono)] text-[10px] text-ink-4 tracking-[0.08em] uppercase">
              [{String(i + 1).padStart(2, "0")}] {s.src}
            </span>

            {/* Big number */}
            <div className="font-[family-name:var(--font-display)] text-[clamp(48px,5.5vw,78px)] leading-[0.95] tracking-[-0.02em] text-ink">
              {s.n}
              {s.unit && (
                <span className="text-[0.55em] text-ink-3 ml-1.5">{s.unit}</span>
              )}
            </div>

            {/* Label */}
            <p className="mt-3.5 text-[14.5px] leading-[1.4] text-ink-2 max-w-[26ch]">
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
        <div className="mt-5 flex flex-wrap gap-7 font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3 tracking-[0.04em]">
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
