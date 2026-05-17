/**
 * OR Memory-Care Signal Badges
 *
 * Renders up to four independent regulatory badges for OR facilities:
 *   1. MCE Endorsed    — ORS 443.886 Memory Care Endorsement (teal)
 *   2. AFH Class       — Adult Foster Home class chip (ink, e.g. "AFH-3 · Dementia training")
 *   3. Enhanced Oversight — APD Enhanced Oversight program (amber/warn)
 *   4. Unendorsed MC   — ORS 443.886(6) violation: "Memory Care" in name without MCE (red)
 *
 * Appears directly below the facility name in FacilityHero for OR facilities.
 * Returns null when no signals are active.
 */

import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";

interface Props {
  signals: NonNullable<FacilityProfile["orMcSignals"]>;
}

interface BadgeProps {
  label: string;
  title: string;
  tone?: "teal" | "warn" | "danger" | "ink";
  href?: string;
}

function Badge({ label, title, tone = "teal", href }: BadgeProps) {
  const colorMap: Record<string, string> = {
    teal:   "bg-teal/10 text-teal border border-teal/20",
    warn:   "bg-amber-50 text-amber-700 border border-amber-200",
    danger: "bg-rust/10 text-rust border border-rust/20",
    ink:    "bg-ink/8 text-ink/70 border border-ink/15",
  };
  const cls = `inline-flex items-center px-2 py-0.5 rounded font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] ${colorMap[tone]}`;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} title={title}>
        {label}
      </a>
    );
  }
  return (
    <span className={cls} title={title}>
      {label}
    </span>
  );
}

export function OrMcSignalBadges({ signals }: Props) {
  const { mceEndorsed, mceEvidence, afhClass, enhancedOversight, unendorsedMcViolation } = signals;

  const hasAny = mceEndorsed || afhClass !== null || enhancedOversight || unendorsedMcViolation;
  if (!hasAny) return null;

  const mceTitle = mceEvidence
    ? `ORS 443.886 Memory Care Endorsement — verified via ${mceEvidence}`
    : "ORS 443.886 Memory Care Endorsement";

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {mceEndorsed && (
        <Badge
          label="Endorsed Memory Care Community"
          title={mceTitle}
          tone="teal"
        />
      )}
      {afhClass !== null && (
        <Badge
          label={`AFH-${afhClass}${afhClass === 3 ? " · Dementia training" : ""}`}
          title={
            afhClass === 3
              ? "Adult Foster Home Class 3 — meets OR-DHS dementia specialty training standards"
              : `Adult Foster Home Class ${afhClass}`
          }
          tone="ink"
        />
      )}
      {enhancedOversight && (
        <Badge
          label="APD Enhanced Oversight"
          title="This facility is currently under OR-APD Enhanced Oversight & Supervision"
          tone="warn"
          href="https://www.oregon.gov/odhs/licensing/community-based-care/Pages/eo.aspx"
        />
      )}
      {unendorsedMcViolation && (
        <Badge
          label="Unendorsed Memory Care — ORS 443.886(6)"
          title="This facility uses 'Memory Care' in its name without holding the required ORS 443.886 endorsement"
          tone="danger"
        />
      )}
    </div>
  );
}
