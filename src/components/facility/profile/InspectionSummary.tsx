import { PROFILE_CITATION_WINDOW_YEARS } from "@/lib/facility/citationWindow";

type Props = {
  lastInspected: string | null;
  inspectionCount: number;
  citationCount: number;
  /** Washington only. Printed when a complaint investigation is on file. */
  lastComplaintInvestigated?: string | null;
  /** California only. Type A and Type B counts from the same window as the headline. */
  distribution?: string | null;
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
  lastComplaintInvestigated,
  distribution,
}: Props) {
  const inspections = countWord(inspectionCount, "inspection", "inspections");
  const citations = countWord(citationCount, "citation", "citations");
  return (
    <p className={inspectionSummaryClassName}>
      {lastInspected ? `Last inspection ${lastInspected}. ` : null}
      {lastComplaintInvestigated ? `Last complaint investigation ${lastComplaintInvestigated}. ` : null}
      {inspections} and {citations} in the last {PROFILE_CITATION_WINDOW_YEARS} years.
      {distribution ? ` ${distribution}` : null}
    </p>
  );
}
