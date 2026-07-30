"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  stateSlug: string;
  stateName: string;
  facilityCount: number;
};

export function HeroFacilitySearch({ stateSlug, stateName, facilityCount }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const dest = q
      ? `/${stateSlug}/facilities?q=${encodeURIComponent(q)}`
      : `/${stateSlug}/facilities`;
    router.push(dest);
  }

  return (
    <div className="w-full min-w-0 max-w-[460px]">
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-clearing-rule-2" aria-hidden />
        <span className="select-none font-[family-name:var(--font-sans)] text-[12px] font-medium uppercase tracking-[0.1em] text-ink-4">
          or search by name
        </span>
        <span className="h-px flex-1 bg-clearing-rule-2" aria-hidden />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-0 rounded-[18px] border border-clearing-rule-2 bg-clearing-card p-2.5 shadow-[var(--shadow-hero-search)] sm:flex-row sm:items-stretch"
        style={{ fontSize: 16 }}
      >
        <div className="relative flex min-w-0 flex-1 items-center">
          <svg
            className="absolute left-3.5 shrink-0 text-ink-4"
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden
          >
            <path
              d="M10 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm-.691 3.516a4.5 4.5 0 1 1 .707-.707l2.838 2.837a.5.5 0 0 1-.708.708L9.31 10.016Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search facilities in ${stateName}…`}
            className="w-full min-w-0 border-0 bg-transparent py-3.5 pr-3 pl-9 font-[family-name:var(--font-sans)] text-[15px] text-ink outline-none placeholder:text-ink-4 sm:py-3.5"
            aria-label={`Search facilities in ${stateName}`}
          />
        </div>
        <button
          type="submit"
          className="flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-0 bg-teal px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-teal-deep sm:w-auto sm:py-0"
        >
          Search <span aria-hidden>→</span>
        </button>
      </form>

      <div className="mt-3">
        <Link
          href={`/${stateSlug}/facilities`}
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-sans)] text-[13px] font-medium text-ink-3 transition-colors hover:text-teal"
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--color-teal)" }}
            aria-hidden
          />
          Browse all {facilityCount} {stateName} facilities →
        </Link>
      </div>
    </div>
  );
}
