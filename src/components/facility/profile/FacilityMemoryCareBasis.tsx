import { DataFootnote } from "@/components/editorial/DataFootnote";
import { formatRecordDate } from "@/lib/format/formatRecordDate";
import type { MemoryCareBasis } from "@/lib/facility/memoryCareBasis";

export function FacilityMemoryCareBasis({ basis }: { basis: MemoryCareBasis }) {
  const checked = basis.checkedOn ? formatRecordDate(basis.checkedOn) : null;

  return (
    <div className="mt-4 max-w-[58ch] border-t border-clearing-rule pt-4">
      <p className="m-0 font-[family-name:var(--font-sans)] text-[15px] leading-[1.5] text-ink-2">
        {basis.label}
      </p>
      {basis.quote ? (
        <blockquote className="mt-3 mb-0 border-l-2 border-teal/40 pl-3 font-[family-name:var(--font-mono)] text-[12px] leading-[1.45] text-ink-3">
          {basis.quote}
        </blockquote>
      ) : null}
      {checked ? (
        <p className="mt-2 mb-0 font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] text-ink-3">
          State records checked {checked}
        </p>
      ) : null}
      <DataFootnote source={basis.regulator} />
      {basis.sourceUrl ? (
        <a
          href={basis.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
        >
          {basis.regulatorShort} record
        </a>
      ) : null}
    </div>
  );
}
