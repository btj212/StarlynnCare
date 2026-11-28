import { regulatorFor } from "@/lib/states/regulators";

export const TEXAS_RECENT_RESULTS =
  "Texas Health and Human Services has not published recent inspection results for this home.";

/** The window is empty. Older rows, if any, are not a recent published result. */
export function texasRecentResultsUnpublished(
  stateCode: string,
  inspectionCount: number,
  citationCount: number,
): boolean {
  return stateCode.toUpperCase() === "TX" && inspectionCount < 1 && citationCount < 1;
}

export function texasRegulatorRecordUrl(): string | null {
  return regulatorFor("TX")?.portalUrl ?? null;
}

export function texasRecentResultsSentence(recordUrl: string | null): string {
  if (!recordUrl) return TEXAS_RECENT_RESULTS;
  return `${TEXAS_RECENT_RESULTS} State record: ${recordUrl}`;
}
