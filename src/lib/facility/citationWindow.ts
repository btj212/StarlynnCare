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
