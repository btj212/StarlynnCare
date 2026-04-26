import type { ReactNode } from "react";

interface SectionHeadProps {
  /** Short label like "§ 01 · The Public Record" — rendered in small-caps JetBrains Mono */
  label: string;
  /** Main headline — supports a ReactNode so callers can italicise part of the title */
  title: ReactNode;
  /** Optional deck / sub-heading below the title */
  deck?: ReactNode;
  /** Invert colours for dark-background sections (e.g. editorial teasers) */
  invert?: boolean;
}

/**
 * Broadsheet-style section header used on every hub page.
 * Label sits in a 1-column sidebar, title fills the remaining space.
 */
export function SectionHead({ label, title, deck, invert = false }: SectionHeadProps) {
  const labelCls = invert
    ? "font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-gold border-t-2 border-gold pt-2.5"
    : "font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust border-t-2 border-ink pt-2.5";

  const titleCls = invert
    ? "font-[family-name:var(--font-display)] font-normal text-[clamp(36px,4vw,56px)] leading-[1.04] tracking-[-0.015em] text-paper m-0 [&_em]:italic [&_em]:text-gold"
    : "font-[family-name:var(--font-display)] font-normal text-[clamp(36px,4vw,56px)] leading-[1.04] tracking-[-0.015em] text-ink m-0 [&_em]:italic [&_em]:text-rust";

  const deckCls = invert
    ? "mt-3 text-[17px] leading-relaxed text-paper/75"
    : "mt-3 text-[17px] leading-relaxed text-ink-3";

  return (
    <div className="grid gap-12 mb-12 items-end md:grid-cols-[1fr_2fr]">
      <div className={labelCls}>{label}</div>
      <div>
        <h2 className={titleCls}>{title}</h2>
        {deck && <p className={deckCls}>{deck}</p>}
      </div>
    </div>
  );
}
