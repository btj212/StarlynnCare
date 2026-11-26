import { DataFootnote } from "@/components/editorial/DataFootnote";
import { formatRecordDate } from "@/lib/format/formatRecordDate";
import {
  AZ_MC_LEVEL1_LABEL,
  AZ_MC_LEVEL2_LABEL,
  type AzMcProgram,
} from "@/lib/facility/azMcProgram";

type Props = {
  program: AzMcProgram;
  regulatorShort: string;
  regulatorUrl: string | null;
};

/**
 * Two-level Arizona memory-care badge.
 * Level 1 is the Directed Care license (neutral). Level 2 is an operator-
 * sourced program confirmation (visually distinct). Neither changes listing.
 */
export function AzMemoryCareBadges({ program, regulatorShort, regulatorUrl }: Props) {
  const checked = program.checkedOn ? formatRecordDate(program.checkedOn) : null;

  return (
    <div className="mt-4 max-w-[58ch] space-y-2.5 border-t border-clearing-rule pt-4">
      <p
        className="m-0 rounded-lg border border-paper-rule bg-paper-2 px-3 py-2 font-[family-name:var(--font-sans)] text-[13px] leading-[1.45] text-ink-3"
        data-az-mc-level="1"
      >
        {AZ_MC_LEVEL1_LABEL}
      </p>
      {program.confirmed ? (
        <div
          className="rounded-lg border border-teal/35 bg-teal-soft px-3 py-2.5"
          data-az-mc-level="2"
        >
          {program.sourceUrl ? (
            <a
              href={program.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal-deep underline decoration-teal/40 underline-offset-4 hover:decoration-teal"
            >
              {AZ_MC_LEVEL2_LABEL}
            </a>
          ) : (
            <p className="m-0 font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal-deep">
              {AZ_MC_LEVEL2_LABEL}
            </p>
          )}
          {checked ? (
            <p className="mt-1 mb-0 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-teal">
              Checked {checked}
            </p>
          ) : null}
          {program.quote ? (
            <blockquote className="mt-2 mb-0 border-l-2 border-teal/50 pl-3 font-[family-name:var(--font-mono)] text-[12px] leading-[1.45] text-ink-2">
              {program.quote}
            </blockquote>
          ) : null}
        </div>
      ) : null}
      <DataFootnote source="ADHS BRFL / A.A.C. R9-10-816" />
      {regulatorUrl ? (
        <a
          href={regulatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
        >
          {regulatorShort} record
        </a>
      ) : null}
    </div>
  );
}
