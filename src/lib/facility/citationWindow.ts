/**
 * Every public citation count names its window and source.
 * Profile sections show the free-tier display window (3 years).
 * Hub lists and city A–Z counts use every year in the ingested state file.
 */

export const PROFILE_CITATION_WINDOW_YEARS = 3;

export function profileCitationWindowPhrase(agencyShort: string): string {
  return `in the last ${PROFILE_CITATION_WINDOW_YEARS} years (${agencyShort})`;
}

export function allYearsCitationWindowPhrase(agencyShort: string): string {
  return `all years on file (${agencyShort})`;
}

export function citationCountPhrase(opts: {
  count: number;
  agencyShort: string;
  window: "profile" | "all-years";
  kind?: "citation" | "serious";
}): string {
  const kind = opts.kind ?? "citation";
  const noun =
    opts.count === 1
      ? kind === "serious"
        ? "serious citation"
        : "citation"
      : kind === "serious"
        ? "serious citations"
        : "citations";
  const window =
    opts.window === "profile"
      ? profileCitationWindowPhrase(opts.agencyShort)
      : allYearsCitationWindowPhrase(opts.agencyShort);
  if (opts.count === 0) {
    return opts.window === "profile"
      ? `no ${kind === "serious" ? "serious citations" : "citations"} ${window}`
      : `no ${kind === "serious" ? "serious citations" : "citations"} on file, ${window}`;
  }
  const n = opts.count === 1 && kind === "citation" ? "one" : String(opts.count);
  return `${n} ${noun} ${window}`;
}

/** ISO day `years` before `today`. Uses the UTC calendar so tests do not drift. */
export function profileWindowStart(
  today: string,
  years = PROFILE_CITATION_WINDOW_YEARS,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(today);
  if (!match) return today.slice(0, 10);
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  dt.setUTCFullYear(dt.getUTCFullYear() - years);
  return dt.toISOString().slice(0, 10);
}

export function inspectionInProfileWindow(inspectionDate: string, today: string): boolean {
  const day = inspectionDate.slice(0, 10);
  const todayDay = today.slice(0, 10);
  return day >= profileWindowStart(todayDay) && day <= todayDay;
}

/**
 * California always names the three-year window, including when every stored
 * visit is already inside it. Other states keep the older-rows check.
 */
export function countsCoverProfileWindow(stateCode: string, hiddenOlderCount: number): boolean {
  if (stateCode.toUpperCase() === "CA") return true;
  return hiddenOlderCount > 0;
}

export function caTypeDistributionSentence(typeA: number, typeB: number, other: number): string {
  if (other > 0) return `${typeA} Type A, ${typeB} Type B, and ${other} other.`;
  return `${typeA} Type A and ${typeB} Type B.`;
}

export type CitationInspectionInput = {
  id: string;
  inspection_date: string;
  is_complaint?: boolean;
  raw_data?: { outcome?: string | null } | null;
};

export type CitationDeficiencyInput = {
  inspection_id: string;
  class?: string | null;
  /** Accepted and ignored. A null code must not change the count. */
  code?: string | null;
};

export type CitationWindowSummary = {
  inspections: number;
  citations: number;
  typeA: number;
  typeB: number;
  other: number;
  substantiatedWithoutRows: number;
};

/**
 * Headline counts for the profile window.
 * California counts deficiency rows only. A substantiated complaint with no
 * rows stays on that visit and is not added here.
 * Every other state keeps the previous total: rows plus those gaps.
 */
export function summarizeCitationWindow(args: {
  inspections: CitationInspectionInput[];
  deficiencies: CitationDeficiencyInput[];
  stateCode: string;
  today: string;
}): CitationWindowSummary {
  const inWindow = args.inspections.filter((row) =>
    inspectionInProfileWindow(row.inspection_date, args.today),
  );
  const ids = new Set(inWindow.map((row) => row.id));
  const defs = args.deficiencies.filter((row) => ids.has(row.inspection_id));
  const typeA = defs.filter((row) => row.class === "Type A").length;
  const typeB = defs.filter((row) => row.class === "Type B").length;
  const other = defs.length - typeA - typeB;
  const rowsByInspection = new Map<string, number>();
  for (const row of defs) {
    rowsByInspection.set(row.inspection_id, (rowsByInspection.get(row.inspection_id) ?? 0) + 1);
  }
  const substantiatedWithoutRows = inWindow.filter(
    (row) =>
      row.is_complaint === true &&
      row.raw_data?.outcome === "Substantiated" &&
      (rowsByInspection.get(row.id) ?? 0) === 0,
  ).length;
  const citations =
    args.stateCode.toUpperCase() === "CA"
      ? typeA + typeB + other
      : defs.length + substantiatedWithoutRows;
  return {
    inspections: inWindow.length,
    citations,
    typeA,
    typeB,
    other,
    substantiatedWithoutRows,
  };
}

type SevereCandidate = {
  class?: string | null;
  immediate_jeopardy?: boolean | null;
  severity?: number | null;
};

/** California severe findings are Type A. Other states keep severity ≥ 3 or the stored flag. */
export function isProfileSevereFinding(d: SevereCandidate, stateCode: string): boolean {
  if (stateCode.toUpperCase() === "CA") return d.class === "Type A";
  return Boolean(d.immediate_jeopardy) || (d.severity != null && d.severity >= 3);
}

function daysBefore(today: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(today);
  if (!match) return today.slice(0, 10);
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Newest severe finding inside 90 days. `inspections` must be newest-first;
 * the walk stops at the first visit older than the cutoff.
 */
export function selectMostRecentSevereFinding<
  TDef extends SevereCandidate,
  TInsp extends { id: string; inspection_date: string },
>(args: {
  stateCode: string;
  inspections: TInsp[];
  deficienciesByInspection: Map<string, TDef[]>;
  today: string;
}): { date: string; deficiency: TDef } | null {
  const cutoff = daysBefore(args.today.slice(0, 10), 90);
  for (const insp of args.inspections) {
    if (insp.inspection_date.slice(0, 10) < cutoff) break;
    const defs = args.deficienciesByInspection.get(insp.id) ?? [];
    const severe = defs.find((d) => isProfileSevereFinding(d, args.stateCode));
    if (severe) return { date: insp.inspection_date, deficiency: severe };
  }
  return null;
}
