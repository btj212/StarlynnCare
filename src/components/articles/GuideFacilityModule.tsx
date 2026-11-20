import Link from "next/link";
import { FacilityLookupBox } from "@/components/articles/FacilityLookupBox";
import { HOW_TO_CHECK } from "@/lib/content/howToCheckArticles";
import { COVERED_STATES, stateFromSlug } from "@/lib/states";

type Props = {
  /** State folder the guide lives in. Omit for national guides. */
  stateSlug?: string;
};

const chipCls =
  "inline-block rounded-full border border-paper-rule bg-paper px-3.5 py-1.5 text-[14px] text-teal no-underline transition-colors hover:border-rust/40";

/**
 * Sits at the top of every guide. 88% of guide visitors left without opening a
 * home, so each guide offers the next step: look up a home, or pick a state.
 */
export function GuideFacilityModule({ stateSlug }: Props) {
  const state = stateSlug ? stateFromSlug(stateSlug) : null;
  const howTo = state ? HOW_TO_CHECK[state.code as keyof typeof HOW_TO_CHECK] : undefined;

  if (state && howTo) {
    return (
      <div className="mt-6">
        <FacilityLookupBox
          stateSlug={state.slug}
          stateName={state.name}
          regulatorName={howTo.regulatorName}
          regulatorUrl={howTo.regulatorUrl}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-paper-rule bg-paper-2 px-5 py-5">
      <p className="m-0 mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust">
        See a home&apos;s inspection record
      </p>
      {state ? (
        <p className="m-0 text-[16px] leading-[1.6] text-ink-2">
          Search every published {state.name} home by name and open its inspection record.{" "}
          <Link href={`/${state.slug}/facilities`} className="text-teal underline underline-offset-4">
            Browse {state.name} facilities
          </Link>
        </p>
      ) : (
        <>
          <p className="m-0 mb-3 text-[16px] leading-[1.6] text-ink-2">
            Pick a state to search its homes by name and open each inspection record.
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {COVERED_STATES.map((s) => (
              <li key={s.code}>
                <Link href={`/${s.slug}/facilities`} className={chipCls}>
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
