import { PROFILE_CITATION_WINDOW_YEARS } from "@/lib/facility/citationWindow";
import { TEXAS_RECENT_RESULTS } from "@/lib/facility/texasRecord";

type Props = {
  lastInspected: string | null;
  inspectionCount: number;
  citationCount: number;
  /** Washington complaint investigations in the same window. Not counted as inspections. */
  complaintCount?: number;
  /** Washington only. Printed when a complaint investigation is on file. */
  lastComplaintInvestigated?: string | null;
  /** California only. Type A and Type B counts from the same window as the headline. */
  distribution?: string | null;
  /** Texas, when the window has no published results. */
  texasRecordUrl?: string | null;
  /**
   * Texas, when visits are on file and the citation count is not.
   * Replaces a "0 citations" count.
   */
  zeroCitationNote?: string | null;
};

function countWord(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Shared with the previous-facility list so those lines match this summary. */
export const inspectionSummaryClassName =
  "mt-4 mb-0 max-w-[58ch] font-[family-name:var(--font-sans)] text-[15px] leading-snug text-ink-2";

/** Counts already loaded for the profile window. Nothing here is estimated. */
export function InspectionSummary({
  lastInspected,
  inspectionCount,
  citationCount,
  complaintCount = 0,
  lastComplaintInvestigated,
  distribution,
  texasRecordUrl,
  zeroCitationNote = null,
}: Props) {
  const inspections = countWord(inspectionCount, "inspection", "inspections");
  const citations = countWord(citationCount, "citation", "citations");
  const unpublishedTexas = texasRecordUrl !== undefined && inspectionCount < 1 && citationCount < 1;
  const counts =
    zeroCitationNote && citationCount < 1
      ? `${inspections} in the last ${PROFILE_CITATION_WINDOW_YEARS} years. ${zeroCitationNote}`
      : complaintCount > 0
        ? `${inspections}, ${countWord(complaintCount, "complaint investigation", "complaint investigations")}, and ${citations}`
        : `${inspections} and ${citations}`;
  return (
    <p className={inspectionSummaryClassName}>
      {lastInspected ? `Last inspection ${lastInspected}. ` : null}
      {lastComplaintInvestigated ? `Last complaint investigation ${lastComplaintInvestigated}. ` : null}
      {unpublishedTexas ? (
        <>
          {TEXAS_RECENT_RESULTS}{" "}
          {texasRecordUrl ? (
            <a href={texasRecordUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Texas HHS record
            </a>
          ) : null}
        </>
      ) : (
        <>
          {zeroCitationNote && citationCount < 1
            ? counts
            : `${counts} in the last ${PROFILE_CITATION_WINDOW_YEARS} years.`}
        </>
      )}
      {distribution ? ` ${distribution}` : null}
    </p>
  );
}
