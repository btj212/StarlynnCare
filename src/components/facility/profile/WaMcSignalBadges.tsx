/**
 * WA Memory-Care Signal Badges
 *
 * Renders up to four independent regulatory badges for WA facilities:
 *   1. Memory Care Certified  — state certification of a dedicated MC unit
 *   2. EARC-SDC Contract      — DSHS Specialized Dementia Care Program contract
 *   3. Dementia Specialty     — training-based dementia specialty designation
 *   4. CMS ★ Rating           — Medicare overall 1–5 star rating (NH only)
 *
 * Appears directly below the facility name in FacilityHero for WA facilities.
 * Returns null when no signals are active AND cmsOverallRating is null.
 */

import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";

interface Props {
  signals: NonNullable<FacilityProfile["waMcSignals"]>;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`CMS ${rating}-star rating`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={i < rating ? "text-gold" : "text-ink/20"}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

interface BadgeProps {
  label: string;
  title: string;
  tone?: "teal" | "rust" | "ink";
}

function Badge({ label, title, tone = "teal" }: BadgeProps) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal/10 text-teal border border-teal/20",
    rust: "bg-rust/10 text-rust border border-rust/20",
    ink: "bg-ink/8 text-ink/70 border border-ink/15",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] ${colorMap[tone]}`}
      title={title}
    >
      {label}
    </span>
  );
}

export function WaMcSignalBadges({ signals }: Props) {
  const { memoryCare, sdcp, dementiaSpecialty, cmsOverallRating } = signals;
  const hasAny = memoryCare || sdcp || dementiaSpecialty || cmsOverallRating !== null;

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {memoryCare && (
        <Badge
          label="Memory Care Certified"
          title="This facility holds a Washington state Memory Care unit certification"
          tone="teal"
        />
      )}
      {sdcp && (
        <Badge
          label="DSHS SDCP"
          title="DSHS Specialized Dementia Care Program contract (EARC-SDC)"
          tone="teal"
        />
      )}
      {dementiaSpecialty && (
        <Badge
          label="Dementia Specialty"
          title="Dementia specialty designation — meets DSHS dementia-training standards"
          tone="teal"
        />
      )}
      {cmsOverallRating !== null && (
        <span
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px]"
          title={`CMS Medicare overall rating: ${cmsOverallRating} out of 5 stars`}
        >
          <span className="text-ink/50 text-[10px] uppercase tracking-[0.14em]">CMS</span>
          <StarRating rating={cmsOverallRating} />
        </span>
      )}
    </div>
  );
}
