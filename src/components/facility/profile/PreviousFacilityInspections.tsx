import type {
  AddressSuccessorLink,
  PreviousFacilityAtAddress,
} from "@/lib/facility/addressSuccessor";
import { inspectionSummaryClassName } from "./InspectionSummary";

export const PREVIOUS_FACILITY_HEADING =
  "Inspection records of previous facilities at this address";

export const PREVIOUS_FACILITY_EXPLANATION =
  "These inspections belong to a previously licensed facility at this address, not the current operator.";

function citationLabel(count: number): string {
  return count === 1 ? "1 citation" : `${count} citations`;
}

/**
 * Inspections of homes that used to be licensed at this address.
 * They are not this operator's record.
 */
export function PreviousFacilityInspections({
  facilities,
}: {
  facilities: PreviousFacilityAtAddress[];
}) {
  if (facilities.length === 0) return null;

  return (
    <section
      aria-labelledby="previous-facilities-heading"
      className="border-t border-paper-rule bg-paper"
    >
      <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-8">
        <h2
          id="previous-facilities-heading"
          className="m-0 font-[family-name:var(--font-display)] text-[clamp(28px,4vw,44px)] font-normal leading-[1.05] tracking-[-0.02em] text-ink"
        >
          {PREVIOUS_FACILITY_HEADING}
        </h2>
        <p className={inspectionSummaryClassName}>{PREVIOUS_FACILITY_EXPLANATION}</p>
        <div className="mt-8 space-y-8">
          {facilities.map((facility) => (
            <article key={facility.id}>
              <h3 className="m-0 font-[family-name:var(--font-display)] text-[22px] font-normal text-ink">
                {facility.name}
              </h3>
              {facility.licenseNumber ? (
                <p className="mt-1 mb-0 font-[family-name:var(--font-mono)] text-[13px] text-ink-3">
                  License {facility.licenseNumber}
                </p>
              ) : null}
              {facility.licensedLabel ? (
                <p className="mt-1 mb-0 font-[family-name:var(--font-sans)] text-[14px] leading-snug text-ink-2">
                  {facility.licensedLabel}
                </p>
              ) : null}
              {facility.inspections.length > 0 ? (
                <ul className="m-0 list-none p-0">
                  {facility.inspections.map((inspection) => (
                    <li key={inspection.id} className={inspectionSummaryClassName}>
                      {inspection.dateLabel}. {citationLabel(inspection.citationCount)}.
                      {inspection.sourceUrl ? (
                        <>
                          {" "}
                          <a
                            href={inspection.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal underline underline-offset-4"
                          >
                            Source
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Shown on a closed profile when the new home at this address is public. */
export function ClosedSuccessorLink({
  successor,
}: {
  successor: AddressSuccessorLink | null;
}) {
  if (!successor) return null;
  return (
    <p className="mt-4 mb-0">
      <a
        href={successor.href}
        className="font-[family-name:var(--font-sans)] text-[15px] leading-snug text-teal underline underline-offset-4"
      >
        Now operating at this address: {successor.name}
      </a>
    </p>
  );
}
