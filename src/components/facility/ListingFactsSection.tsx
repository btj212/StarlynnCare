"use client";

import type { ListingFactKey, ListingVerdict, ShownListingFact } from "@/lib/facility/homeOutreach";

const input =
  "w-full rounded-[10px] border border-clearing-rule-2 bg-clearing-card px-3 py-2.5 text-[15px] text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export type ListingFieldState = {
  verdict: ListingVerdict | "";
  correction: string;
};

type Props = {
  facts: ShownListingFact[];
  fields: Record<ListingFactKey, ListingFieldState>;
  allCorrect: boolean;
  onAllCorrect: () => void;
  onVerdict: (key: ListingFactKey, verdict: ListingVerdict) => void;
  onCorrection: (key: ListingFactKey, correction: string) => void;
};

export function ListingFactsSection({
  facts,
  fields,
  allCorrect,
  onAllCorrect,
  onVerdict,
  onCorrection,
}: Props) {
  return (
    <fieldset className="rounded-[16px] border border-clearing-rule-2 bg-clearing-card px-5 py-5 shadow-[var(--shadow-card)] md:px-6">
      <legend className="mb-2 block font-[family-name:var(--font-sans)] text-[15px] font-semibold text-ink">
        What we show today
      </legend>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-3">
        These are the facts on the public listing. Mark each one. A person reviews
        corrections before anything on the profile changes.
      </p>
      <div className="space-y-4">
        {facts.map((fact) => {
          const state = fields[fact.key];
          return (
            <div key={fact.key} className="border-t border-paper-rule pt-4">
              <p className="mb-1 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                {fact.label}
              </p>
              <p className="mb-2 m-0 font-[family-name:var(--font-mono)] text-[14px] text-ink">
                {fact.shown}
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-[15px] text-ink-2">
                  <input
                    type="radio"
                    name={`listing-${fact.key}`}
                    checked={state.verdict === "correct"}
                    onChange={() => onVerdict(fact.key, "correct")}
                    className="h-4 w-4 accent-[var(--color-teal)]"
                  />
                  Correct
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[15px] text-ink-2">
                  <input
                    type="radio"
                    name={`listing-${fact.key}`}
                    checked={state.verdict === "fix"}
                    onChange={() => onVerdict(fact.key, "fix")}
                    className="h-4 w-4 accent-[var(--color-teal)]"
                  />
                  Needs a fix
                </label>
              </div>
              {state.verdict === "fix" ? (
                <input
                  aria-label={`Correct ${fact.label}`}
                  placeholder="What should it say?"
                  value={state.correction}
                  onChange={(e) => onCorrection(fact.key, e.target.value)}
                  maxLength={200}
                  className={`${input} mt-2`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAllCorrect}
        className={`mt-5 rounded-full border px-3.5 py-1.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold ${
          allCorrect
            ? "border-teal/40 bg-teal-soft text-teal-deep"
            : "border-paper-rule bg-paper-2 text-ink-2 hover:border-teal/40"
        }`}
      >
        Everything above is correct
      </button>
    </fieldset>
  );
}
