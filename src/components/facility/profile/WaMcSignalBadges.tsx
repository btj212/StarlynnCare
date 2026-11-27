import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { dementiaAcceptanceTier } from "@/lib/facility/memoryCareBasis";

/**
 * WA Memory-Care Signal Badges
 *
 * Renders the DSHS designations that actually mean memory care, plus CMS stars:
 *   1. Memory Care Certified  — state certification of a dedicated MC unit
 *   2. EARC-SDC Contract      — DSHS Specialized Dementia Care Program contract
 *   3. CMS ★ Rating           — Medicare overall 1–5 star rating (NH only)
 *
 * An adult family home with the DSHS dementia specialty shows a separate
 * neutral badge. That is staff training, not a secured unit.
 *
 * Appears directly below the facility name in FacilityHero for WA facilities.
 * Returns null when no signals are active AND cmsOverallRating is null.
 */

export type WaMcSignalInput = {
  wa_memory_care_certified?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
  wa_dementia_care_contract?: boolean | null;
  wa_facility_type?: string | null;
  wa_dementia_specialty?: boolean | null;
  mc_program_confirmed?: boolean | null;
  mc_program_source_url?: string | null;
  mc_designation_type?: string | null;
  mc_program_quote?: string | null;
  mc_review_notes?: string | null;
  cms_overall_rating?: number | null;
};

export type WaMcSignals = {
  memoryCare: boolean;
  sdcp: boolean;
  acceptsDementia: boolean;
  dementiaCredential: boolean;
  cmsOverallRating: number | null;
};

/** Badges for a Washington row. Specialty is the second tier, never memory care. */
export function waMcSignalsFromRow(row: WaMcSignalInput): WaMcSignals {
  const tier = dementiaAcceptanceTier({
    state_code: "WA",
    wa_memory_care_certified: row.wa_memory_care_certified,
    wa_earc_sdc_contracted: row.wa_earc_sdc_contracted,
    wa_dementia_care_contract: row.wa_dementia_care_contract,
    wa_facility_type: row.wa_facility_type,
    wa_dementia_specialty: row.wa_dementia_specialty,
    mc_program_confirmed: row.mc_program_confirmed,
    mc_program_source_url: row.mc_program_source_url,
    mc_designation_type: row.mc_designation_type,
    mc_program_quote: row.mc_program_quote,
    mc_review_notes: row.mc_review_notes,
  });
  return {
    memoryCare: row.wa_memory_care_certified ?? false,
    sdcp: Boolean(row.wa_earc_sdc_contracted || row.wa_dementia_care_contract),
    acceptsDementia: tier === "confirmed-accepts",
    dementiaCredential: tier === "credential",
    cmsOverallRating: row.cms_overall_rating ?? null,
  };
}

export function waMcSignalsHaveAny(signals: WaMcSignals): boolean {
  return (
    signals.memoryCare ||
    signals.sdcp ||
    signals.acceptsDementia ||
    signals.dementiaCredential ||
    signals.cmsOverallRating !== null
  );
}

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
  const { memoryCare, sdcp, acceptsDementia, dementiaCredential, cmsOverallRating } = signals;
  const hasAny = waMcSignalsHaveAny(signals);

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
      {acceptsDementia && (
        <Badge
          label="Confirmed: accepts residents with dementia"
          title="The home told StarlynnCare it accepts residents with dementia. This is not a secured or dedicated memory-care unit."
          tone="ink"
        />
      )}
      {dementiaCredential && (
        <Badge
          label="Dementia credential"
          title="Staff completed Washington dementia training. This does not confirm the home accepts residents with dementia, and it is not a secured unit."
          tone="ink"
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
