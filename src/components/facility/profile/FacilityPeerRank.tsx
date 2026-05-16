import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";
import { peerRankBarFillCss } from "@/lib/peerRankBar";

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
  percentile: number | null;
  peerMedian?: number | null;
  desc: string;
};

function MetricCell({ label, percentile, peerMedian, desc }: MetricCellProps) {
  // Suppress when the metric is degenerate: peer_median = 0 means the majority
  // of the peer group has zero repeat citations, so everyone ties at 100th and
  // the ranking carries no information. Treat identically to the null/no-data case.
  const isDegenerate = peerMedian === 0 && percentile === 100;

  // null means the metric is genuinely unavailable (e.g. no routine inspections
  // for frequency rank) — render a suppressed card rather than a misleading 0th.
  if (percentile === null || isDegenerate) {
    const suppressedMsg = isDegenerate
      ? <>Not enough repeat citations<br />among peers to rank.</>
      : <>No routine inspections<br />on file.</>;
    return (
      <div className="bg-paper-2 p-7 pb-6 flex flex-col">
        <div className="mb-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-ink-3">
          {label}
        </div>
        <div className="font-[family-name:var(--font-display)] text-[28px] leading-[1.2] tracking-[-0.02em] text-ink-3 italic">
          {suppressedMsg}
        </div>
        <div className="mt-4 font-[family-name:var(--font-display)] text-[16px] italic leading-[1.3] text-ink-2">
          {desc}
        </div>
      </div>
    );
  }

  const pct = percentile;
  const fillColor = peerRankBarFillCss(pct);

  return (
    <div className="bg-paper-2 p-7 pb-6">
      <div className="mb-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </div>
      <div
        className="font-[family-name:var(--font-display)] text-[96px] leading-[0.85] tracking-[-0.04em]"
        style={{ color: fillColor }}
      >
        {pct}
        <sup className="font-[family-name:var(--font-mono)] text-[0.3em] tracking-[0.04em] text-ink-2 align-super">th</sup>
      </div>
      <div className="mt-4 font-[family-name:var(--font-display)] text-[16px] italic leading-[1.3] text-ink-2">
        {desc}
      </div>
      {/* Scale bar */}
      <div className="relative mt-5 h-7">
        {/* Track */}
        <div className="absolute left-0 right-0 top-3 h-1 border border-paper-rule bg-paper" />
        {/* Tertile zone markers (faint) */}
        <div className="absolute top-3 h-1 opacity-20" style={{ left: 0, width: "33.33%", background: "var(--color-grade-f)" }} />
        <div className="absolute top-3 h-1 opacity-20" style={{ left: "33.33%", width: "33.34%", background: "var(--color-gold)" }} />
        <div className="absolute top-3 h-1 opacity-20" style={{ left: "66.67%", width: "33.33%", background: "var(--color-grade-a)" }} />
        {/* Fill */}
        <div
          className="absolute left-0 top-3 h-1"
          style={{ width: `${pct}%`, background: fillColor }}
        />
        {/* Median tick */}
        <div className="absolute left-1/2 top-1.5 h-4 w-px -translate-x-1/2 bg-ink-3" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 font-[family-name:var(--font-mono)] text-[9px] text-ink-3 tracking-[0.06em]">
          peer median
        </div>
        {/* Ends */}
        <div className="absolute left-0 top-[26px] font-[family-name:var(--font-mono)] text-[9px] text-ink-4 tracking-[0.06em]">0</div>
        <div className="absolute right-0 top-[26px] font-[family-name:var(--font-mono)] text-[9px] text-ink-4 tracking-[0.06em]">100</div>
      </div>
    </div>
  );
}

export function FacilityPeerRank({ profile }: { profile: FacilityProfile }) {
  const { facility, snapshot, state, cfg } = profile;
  const careLabel = CARE_LABEL[facility.care_category] ?? "care";
  const peerN = snapshot?.peer_set.n ?? 0;
  const fallbackLevel = snapshot?.peer_set.fallback_level ?? 1;
  const bedNormalized = fallbackLevel === 0;

  const peerNLabel = peerN > 0 ? peerN.toLocaleString() : "similar";
  const peerTitle = bedNormalized
    ? <><em>{peerNLabel} {state.name} facilities with a similar number of beds.</em></>
    : <><em>{peerNLabel} {state.name} facilities.</em></>;

  return (
    <section id="peer" className="bg-ink py-16 text-paper">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="§ 02 · Peer Comparison"
          title={<>Compared to {peerTitle}</>}
          deck={
            `${careLabel.charAt(0).toUpperCase() + careLabel.slice(1)} · ${cfg.inspectionWindowMonths}-month window. Higher percentile = better performance on inspection record.` +
            ` Source: ${cfg.agencyLong}.`
          }
          invert
        />

        {!snapshot || !snapshot.has_inspections ? (
          <div className="rounded-sm bg-paper-2/10 px-6 py-8 text-center text-paper/60 font-[family-name:var(--font-mono)] text-[13px] tracking-wide">
            Peer comparison data not yet available — inspection records for this facility are still being indexed.
          </div>
        ) : (
          <>
            <div className="grid gap-1 md:grid-cols-3">
              <MetricCell
                label="Severity rank"
                percentile={snapshot.metrics.severity.percentile}
                desc="Weighted citations per bed."
              />
              <MetricCell
                label="Repeat rank"
                percentile={snapshot.metrics.repeats.percentile}
                peerMedian={snapshot.metrics.repeats.peer_median}
                desc="Repeat deficiencies as share of total."
              />
              <MetricCell
                label="Frequency rank"
                percentile={snapshot.metrics.frequency.percentile}
                desc="Deficiencies per inspection."
              />
            </div>
            <p className="mt-5 font-[family-name:var(--font-mono)] text-[11px] text-paper/50 tracking-[0.06em] leading-relaxed">
              Rankings based on {cfg.inspectionWindowMonths}-month CDSS inspection data. Severity and frequency: fewer citations = higher percentile. Repeat rate: lower repeat citation share = higher percentile.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
