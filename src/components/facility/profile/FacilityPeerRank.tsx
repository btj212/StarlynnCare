import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";

const CARE_LABEL: Record<string, string> = {
  rcfe_memory_care: "RCFE memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF memory care",
  alf_general: "ALF",
  snf_general: "SNF",
  snf_dementia_scu: "SNF dementia care",
  ccrc: "CCRC",
  unknown: "care",
};

type MetricCellProps = {
  label: string;
  value: number | null | undefined;
  peerMedian: number | null | undefined;
  caption: string;
};

function MetricCell({ label, value, peerMedian, caption }: MetricCellProps) {
  if (value == null || peerMedian == null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(peerMedian)) return null;

  return (
    <div className="bg-paper-2 p-7 pb-6">
      <div className="mb-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </div>
      <div className="font-[family-name:var(--font-display)] text-[64px] leading-[0.9] tracking-[-0.04em] text-ink">
        {value.toFixed(2)}
      </div>
      <div className="mt-4 font-[family-name:var(--font-display)] text-[16px] italic leading-[1.3] text-ink-2">
        {caption} {peerMedian.toFixed(2)}
      </div>
    </div>
  );
}

export function FacilityPeerRank({ profile }: { profile: FacilityProfile }) {
  const { facility, snapshot, state, cfg } = profile;
  const careLabel =
    state.code === "CO" && facility.care_category === "alf_memory_care"
      ? "assisted living memory care"
      : state.code === "CO" && facility.care_category === "alf_general"
        ? "assisted living"
        : state.code === "CO" && facility.care_category === "snf_dementia_scu"
          ? "nursing home memory care"
          : state.code === "CO" && facility.care_category === "snf_general"
            ? "nursing home"
            : CARE_LABEL[facility.care_category] ?? "care";
  const peerN = snapshot?.peer_set.n ?? 0;
  const fallbackLevel = snapshot?.peer_set.fallback_level ?? 1;
  // Null beds are grouped with the small bucket by the snapshot function.
  // Illinois does not publish bed counts, so that group is not a bed match.
  const bedNormalized = fallbackLevel === 0 && facility.beds != null;

  const peerNLabel = peerN > 0 ? peerN.toLocaleString() : "similar";
  const peerTitle = bedNormalized
    ? <><em>{peerNLabel} {state.name} facilities with a similar number of beds.</em></>
    : <><em>{peerNLabel} {state.name} facilities.</em></>;

  return (
    <section id="peer" className="scroll-mt-36 md:scroll-mt-28 bg-ink py-16 text-paper">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="Peer Comparison"
          title={peerN < 10 ? <>A comparison needs at least 10 homes.</> : <>Compared to {peerTitle}</>}
          deck={
            peerN < 10
              ? `${careLabel.charAt(0).toUpperCase() + careLabel.slice(1)} · ${cfg.agencyLong}. A comparison needs at least 10 homes in the same care setting.`
              : `${careLabel.charAt(0).toUpperCase() + careLabel.slice(1)} · ${cfg.inspectionWindowMonths}-month window. The figure is this home's measure against the similar-size peer median.` +
                ` Source: ${cfg.agencyLong}.`
          }
          invert
        />

        {!snapshot || !snapshot.has_inspections ? (
          <div className="rounded-sm bg-paper-2/10 px-6 py-8 text-center text-paper/60 font-[family-name:var(--font-mono)] text-[13px] tracking-wide">
            Peer comparison data not yet available — inspection records for this facility are still being indexed.
          </div>
        ) : peerN < 10 ? (
          <div className="rounded-sm bg-paper-2/10 px-6 py-8 text-center text-paper/60 font-[family-name:var(--font-mono)] text-[13px] tracking-wide">
            Not enough homes in this care setting for a comparison. The inspection record below is the record.
          </div>
        ) : (
          <>
            <div className="grid gap-1 md:grid-cols-3">
              <MetricCell
                label="Severity"
                value={snapshot.metrics.severity.value}
                peerMedian={snapshot.metrics.severity.peer_median}
                caption="weighted citations per bed · peer median"
              />
              <MetricCell
                label="Repeat share"
                value={snapshot.metrics.repeats.value}
                peerMedian={snapshot.metrics.repeats.peer_median}
                caption="repeat deficiencies as a share of total · peer median"
              />
              <MetricCell
                label="Frequency"
                value={snapshot.metrics.frequency.value}
                peerMedian={snapshot.metrics.frequency.peer_median}
                caption="deficiencies per inspection · peer median"
              />
            </div>
            <p className="mt-5 font-[family-name:var(--font-mono)] text-[11px] text-paper/50 tracking-[0.06em] leading-relaxed">
              {snapshot.severity_measured === false
                ? `${cfg.agencyShort} does not record a severity on these findings. The other figures are this home's measure against the similar-size peer median over ${cfg.inspectionWindowMonths} months.`
                : `Figures are this home's measure against the similar-size peer median over ${cfg.inspectionWindowMonths} months (${cfg.agencyShort}). A lower weighted-citation figure means fewer citations per bed.`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
