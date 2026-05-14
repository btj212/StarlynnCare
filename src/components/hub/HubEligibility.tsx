import { SectionHead } from "@/components/editorial/SectionHead";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { getStateEligibility } from "@/lib/content/stateEligibility";

interface HubEligibilityProps {
  stateCode: string;
  regionName: string;
}

/**
 * State-specific Medicaid/waiver eligibility section for city and county hub pages.
 * Returns null when no eligibility content is configured for the state.
 * All content cites the official state program source.
 */
export function HubEligibility({ stateCode, regionName }: HubEligibilityProps) {
  const entry = getStateEligibility(stateCode);
  if (!entry) return null;

  return (
    <div className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
        <SectionHead
          label="§ Payment & eligibility"
          title={
            <>
              Paying for memory care <em>in {regionName}.</em>
            </>
          }
        />

        <div className="mt-6 mb-4 inline-block rounded-sm border border-teal/30 bg-teal/5 px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-teal-deep">
          {entry.programName}
        </div>
        <p className="text-[16px] leading-[1.7] text-ink-2 max-w-[72ch] mb-1">
          {entry.programSummary}
        </p>

        <div className="mt-6 space-y-4 max-w-[72ch]">
          {entry.paragraphs.map((para, i) => (
            <p key={i} className="text-[15.5px] leading-[1.75] text-ink-2">
              {para}
            </p>
          ))}
        </div>

        <div className="mt-6 rounded-sm border-l-2 border-teal pl-4 py-2">
          <p className="text-[14px] leading-relaxed text-ink-3">
            <strong className="font-semibold text-ink-2">Veterans:</strong>{" "}
            {entry.privatePayNote}
          </p>
        </div>

        <div className="mt-6">
          <DataFootnote
            source={entry.sourceLabel}
            note="Program rules change — verify eligibility requirements directly with your county agency before making care decisions"
          />
        </div>
      </div>
    </div>
  );
}
