import type { CareCategory } from "@/lib/types";

/** Homepage rotating sample card (§02) — matches `facility_snapshot` + facilities row */
export type HomeSampleFacility = {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
  slug: string;
  city_slug: string;
  license_number?: string | null;
  beds?: number | null;
  care_category: CareCategory;
  grade: string | null;
  composite: number | null;
  sev_pct: number | null;
  rep_pct: number | null;
  freq_pct: number | null;
  /** Weighted citations per bed. Null when the peer set has fewer than 10 homes. */
  severityValue: number | null;
  severityPeerMedian: number | null;
  repeatsValue: number | null;
  repeatsPeerMedian: number | null;
  frequencyValue: number | null;
  frequencyPeerMedian: number | null;
};

type MetricTriple = {
  value?: number | null;
  percentile?: number | null;
  peer_median?: number | null;
};

function asSnapshot(snap: unknown): {
  peer_set?: { n?: number } | null;
  grade?: { letter?: string; composite_percentile?: number } | null;
  metrics?: {
    severity?: MetricTriple;
    repeats?: MetricTriple;
    frequency?: MetricTriple;
  } | null;
} | null {
  if (!snap || typeof snap !== "object") return null;
  return snap as {
    peer_set?: { n?: number } | null;
    grade?: { letter?: string; composite_percentile?: number } | null;
    metrics?: {
      severity?: MetricTriple;
      repeats?: MetricTriple;
      frequency?: MetricTriple;
    } | null;
  };
}

/** Snapshot fields the sample card is allowed to print. Thin peer sets print nothing. */
export function comparisonFieldsFromSnapshot(snap: unknown): Pick<
  HomeSampleFacility,
  | "grade"
  | "composite"
  | "sev_pct"
  | "rep_pct"
  | "freq_pct"
  | "severityValue"
  | "severityPeerMedian"
  | "repeatsValue"
  | "repeatsPeerMedian"
  | "frequencyValue"
  | "frequencyPeerMedian"
> {
  const parsed = asSnapshot(snap);
  const ready = (parsed?.peer_set?.n ?? 0) >= 10;
  const pair = (metric: MetricTriple | undefined) =>
    ready
      ? { value: metric?.value ?? null, median: metric?.peer_median ?? null }
      : { value: null, median: null };
  const severity = pair(parsed?.metrics?.severity);
  const repeats = pair(parsed?.metrics?.repeats);
  const frequency = pair(parsed?.metrics?.frequency);
  const repPct = parsed?.metrics?.repeats?.percentile ?? null;
  const repMedian = parsed?.metrics?.repeats?.peer_median ?? null;
  return {
    grade: parsed?.grade?.letter ?? null,
    composite: parsed?.grade?.composite_percentile ?? null,
    sev_pct: parsed?.metrics?.severity?.percentile ?? null,
    rep_pct: repMedian === 0 && repPct === 100 ? null : repPct,
    freq_pct: parsed?.metrics?.frequency?.percentile ?? null,
    severityValue: severity.value,
    severityPeerMedian: severity.median,
    repeatsValue: repeats.value,
    repeatsPeerMedian: repeats.median,
    frequencyValue: frequency.value,
    frequencyPeerMedian: frequency.median,
  };
}
