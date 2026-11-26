import Link from "next/link";
import { HOW_TO_CHECK, type HowToState } from "@/lib/content/howToCheckArticles";
import { regulatorFor } from "@/lib/states/regulators";

type Props = {
  stateCode: string;
  stateSlug: string;
  stateName: string;
};

const HOW_TO_CODES = new Set<string>(["AZ", "CA", "IL", "MN", "OR", "PA", "WA"]);

function howToFor(stateCode: string) {
  if (!HOW_TO_CODES.has(stateCode)) return null;
  return HOW_TO_CHECK[stateCode as HowToState];
}

/**
 * Answers regulator-lookup intent on the state hub: official state
 * search + the how-to-check page when we have one.
 */
export function StateHubRegulatorLookup({ stateCode, stateSlug, stateName }: Props) {
  const regulator = regulatorFor(stateCode);
  const howTo = howToFor(stateCode);
  if (!regulator) return null;

  const lookupTitle =
    howTo?.title ??
    (stateCode === "MN"
      ? "Minnesota assisted living report card and license lookup"
      : `${stateName} assisted living license lookup`);

  return (
    <section id="lookup" className="border-b border-clearing-rule bg-clearing-tint">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-[60px] md:py-20">
        <p className="mb-3 inline-block font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal">
          Official lookup
        </p>
        <h2 className="m-0 mb-4 max-w-[22ch] font-[family-name:var(--font-display)] text-[clamp(28px,4vw,40px)] font-normal leading-[1.1] tracking-[-0.02em] text-ink">
          Look up a {stateName} inspection report <em>on the state site.</em>
        </h2>
        <p className="mb-8 max-w-[62ch] text-[17px] leading-[1.55] text-ink-2">
          {howTo?.answer ??
            `Search the home by name or license number on ${regulator.long}. StarlynnCare publishes the memory care homes we hold from that record; the state site is the original.`}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={howTo?.regulatorUrl ?? regulator.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal px-5 text-[14px] font-semibold text-paper no-underline hover:bg-teal-deep"
          >
            Open {howTo?.regulatorName ?? regulator.short} lookup
            <span aria-hidden className="ml-1.5">
              ↗
            </span>
          </a>
          {howTo ? (
            <Link
              href={howTo.path}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-clearing-rule-2 bg-clearing-card px-5 text-[14px] font-semibold text-ink no-underline hover:border-teal/40"
            >
              {lookupTitle} →
            </Link>
          ) : (
            <Link
              href={`/${stateSlug}/facilities`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-clearing-rule-2 bg-clearing-card px-5 text-[14px] font-semibold text-ink no-underline hover:border-teal/40"
            >
              Search {stateName} homes we publish →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
