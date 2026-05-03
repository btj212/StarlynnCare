import type { CaMemoryCareDesignationBasis } from "@/lib/types";

interface Props {
  basis: CaMemoryCareDesignationBasis | null | undefined;
  stateCode: string;
}

interface BasisMeta {
  label: string;
  plain: string;
  /** URL to the relevant CA regulation or source — shown as "Learn more". */
  cite?: string;
}

const BASIS_META: Record<CaMemoryCareDesignationBasis, BasisMeta> = {
  self_identified: {
    label: "Self-identified",
    plain:
      "This facility markets itself as a memory-care provider in its licensed name or operator materials.",
  },
  dementia_training_compliance: {
    label: "§87705 / §87706 verified",
    plain:
      "A CDSS evaluator has cited this facility under California Title 22 §87705 (dementia-training requirements) or §87706 (dementia-advertising requirements), confirming it operates a dementia program.",
    cite: "https://govt.westlaw.com/calregs/Document/I3B6D4060D48611DEBC02831C6D6C108E",
  },
  secured_perimeter: {
    label: "Secured perimeter confirmed",
    plain:
      "Inspection records reference a secured or locked memory-care unit at this facility, confirming a physically separated dementia environment.",
  },
  hospice_waiver: {
    label: "Hospice-waiver pathway",
    plain:
      "This facility operates under California's hospice-waiver provision, which allows licensed hospice patients with dementia to receive memory-care services within a residential care setting.",
  },
  multiple: {
    label: "Multiple bases",
    plain:
      "Two or more regulatory or evidentiary bases apply: the facility is self-identified as memory care, has inspection or citation records confirming a dementia program, or operates a secured unit.",
  },
};

/** Inline badge + plain-language explanation of *why* a facility is classified as memory care. */
export function MemoryCareDesignationBasis({ basis, stateCode }: Props) {
  // Only surfaced for CA facilities that have a resolved basis
  if (stateCode !== "CA" || !basis) return null;

  const meta = BASIS_META[basis];

  return (
    <div className="mt-3 rounded-lg border border-teal/25 bg-teal/5 px-4 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-medium text-teal">
        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
        <span>Memory-care basis: {meta.label}</span>
      </p>
      <p className="mt-1.5 text-ink-2 leading-relaxed">
        {meta.plain}
        {meta.cite && (
          <>
            {" "}
            <a
              href={meta.cite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal underline underline-offset-2 hover:opacity-80"
            >
              Regulation text ↗
            </a>
          </>
        )}
      </p>
    </div>
  );
}
