import { formatInspectionListDate } from "@/lib/format/formatRecordDate";
import {
  TEXAS_RECENT_RESULTS,
  texasRecentResultsUnpublished,
} from "@/lib/facility/texasRecord";

/**
 * Facility-page sentences that name a citation, a license noun, or a peer
 * comparison. Counts are deficiency rows. `inspections.total_deficiency_count`
 * is not a source for these sentences.
 */

export type CitationRecordInput = {
  stateCode?: string | null;
  regulatorAbbr: string;
  /** Deficiency rows whose visit is inside the 3-year window. */
  windowCount: number;
  /** Visits inside that window. Texas uses this so an empty window is not "0 citations". */
  inspectionCount: number;
  /**
   * Deficiency rows we hold, any year, from the bounded inspection list.
   * Omit when the caller only knows the window. `0` means the rows we hold
   * contain no citation.
   */
  heldCount?: number | null;
  /** A deficiency row exists on a visit older than the window. */
  olderCitation?: boolean;
  /** All-time last cited inspection, ISO yyyy-mm-dd. */
  lastCitationDate?: string | null;
  /** Oldest inspection date we hold, ISO yyyy-mm-dd. */
  earliestInspectionDate?: string | null;
};

export function formatCopyDate(iso: string): string {
  return formatInspectionListDate(iso, "day");
}

/**
 * "<N> citations in the last 3 years", plus "Last citation <Mon D, YYYY>"
 * when an older deficiency row exists. When the rows we hold have no
 * citation, name the agency and the earliest inspection we hold.
 * Texas keeps its unpublished / not-published sentences.
 */
export function citationRecordPhrase(input: CitationRecordInput): string {
  const state = input.stateCode ?? "";
  if (texasRecentResultsUnpublished(state, input.inspectionCount, input.windowCount)) {
    return TEXAS_RECENT_RESULTS;
  }
  if (state.toUpperCase() === "TX" && input.windowCount === 0) {
    return "HHSC has not published a citation count for this home in the last 3 years";
  }

  const n = input.windowCount;
  const noun = n === 1 ? "citation" : "citations";
  const windowPhrase = `${n} ${noun} in the last 3 years`;
  const last = input.lastCitationDate ? formatCopyDate(input.lastCitationDate) : null;

  if (input.heldCount === 0 && n === 0) {
    if (input.earliestInspectionDate) {
      return `No citations in the ${input.regulatorAbbr} records we hold since ${formatCopyDate(input.earliestInspectionDate)}`;
    }
    return `No citations in the ${input.regulatorAbbr} records we hold`;
  }

  if (input.olderCitation === true && last) {
    return `${windowPhrase}; Last citation ${last}`;
  }
  return windowPhrase;
}

const ASSISTED_LIVING_NOUN = new Set(["CO", "UT", "IL", "MN"]);

/**
 * "licensed memory care home" only when a state-file basis is recorded.
 * Otherwise the state's license noun.
 */
export function facilityPageNoun(input: {
  stateCode: string;
  basisRecorded: boolean;
  /** Caller already resolved a license noun (Arizona Personal Care, for example). */
  licenseNoun?: string | null;
}): string {
  const supplied = input.licenseNoun?.trim();
  if (supplied) return supplied;
  const code = input.stateCode.toUpperCase();
  if (input.basisRecorded) {
    if (code === "AZ") return "Directed Care licensed home";
    if (code === "WA") return "licensed home that may serve residents with dementia";
    if (code === "PA") return "licensed personal care or assisted living home";
    return "licensed memory care home";
  }
  if (code === "CA") return "state-licensed residential care home for the elderly (RCFE)";
  if (ASSISTED_LIVING_NOUN.has(code)) return "state-licensed assisted living home";
  if (code === "AZ") return "licensed home";
  if (code === "WA") return "licensed home that may serve residents with dementia";
  if (code === "PA") return "licensed personal care or assisted living home";
  if (code === "TX") return "state-licensed assisted living facility";
  if (code === "OR") return "state-licensed residential care home";
  if (code === "MO") return "state-licensed assisted living or residential care home";
  return "state-licensed senior living home";
}

export const BASIS_NOT_RECORDED_SENTENCE =
  "StarlynnCare has not yet recorded a memory-care designation for this home from the state file.";

/**
 * Measured severity against the peer median. Null when either number is missing,
 * so the caller renders nothing.
 */
export function weightedCitationsPerBedPhrase(input: {
  value: number | null | undefined;
  peerMedian: number | null | undefined;
  agencyShort: string;
  windowMonths?: number | null;
}): string | null {
  if (input.value == null || input.peerMedian == null) return null;
  if (!Number.isFinite(input.value) || !Number.isFinite(input.peerMedian)) return null;
  const months = input.windowMonths != null && input.windowMonths > 0 ? input.windowMonths : 36;
  const figure = (n: number) => n.toFixed(2);
  return `Weighted citations per bed: ${figure(input.value)}, against a similar-size peer median of ${figure(input.peerMedian)} (${input.agencyShort}, ${months} months)`;
}

/** Newest visit in `rowsNewestFirst` that has a deficiency row. */
export function newestCitedDate<T extends { id: string; inspection_date: string }>(
  rowsNewestFirst: readonly T[],
  citedIds: ReadonlySet<string>,
): T | null {
  return rowsNewestFirst.find((row) => citedIds.has(row.id)) ?? null;
}
