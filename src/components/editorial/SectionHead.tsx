import type { ReactNode } from "react";

interface SectionHeadProps {
  /** Optional short label — if provided, rendered above the title in small-caps */
  label?: string;
  /** Main headline — supports a ReactNode so callers can italicise part of the title */
  title: ReactNode;
  /** Optional deck / sub-heading below the title */
  deck?: ReactNode;
  /** Invert colours for dark-background sections (e.g. editorial teasers) */
  invert?: boolean;
}

/**
 * Section header used on hub pages.
 * Clearing visual: softer eyebrow, same title/deck API and copy sites.
 */
export function SectionHead({ label, title, deck, invert = false }: SectionHeadProps) {
  const labelCls = invert
    ? "font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-gold"
    : "font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal";
  const dividerCls = invert
    ? "border-t border-gold/40 pt-2.5"
    : "border-t border-clearing-rule-2 pt-2.5";

  const titleCls = invert
    ? "m-0 font-[family-name:var(--font-display)] text-[clamp(28px,4vw,44px)] font-normal leading-[1.08] tracking-[-0.01em] text-paper [&_em]:italic [&_em]:text-gold"
    : "m-0 font-[family-name:var(--font-display)] text-[clamp(28px,4vw,44px)] font-normal leading-[1.08] tracking-[-0.01em] text-ink [&_em]:italic [&_em]:text-teal";

  const deckCls = invert
    ? "mt-3 text-[17px] leading-relaxed text-paper/75"
    : "mt-3 text-[17px] leading-relaxed text-ink-3";

  return (
    <div className="mb-8 grid items-end gap-4 md:mb-12 md:grid-cols-[1fr_2fr] md:gap-12">
      <div className={label ? labelCls : dividerCls}>{label ?? null}</div>
      <div>
        <h2 className={titleCls}>{title}</h2>
        {deck && <p className={deckCls}>{deck}</p>}
      </div>
    </div>
  );
}
