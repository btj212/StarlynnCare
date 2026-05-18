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
    <div className="w-full max-w-[460px] min-w-0">
      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <span className="flex-1 h-px bg-ink opacity-10" aria-hidden />
        <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-ink-4 select-none">
          or search by name
        </span>
        <span className="flex-1 h-px bg-ink opacity-10" aria-hidden />
      </div>

      {/* Facility name search */}
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col border border-ink/25 sm:flex-row sm:items-stretch hover:border-ink/50 focus-within:border-ink transition-colors"
        style={{ borderRadius: 0, fontSize: 16 }}
      >
        <div className="relative flex flex-1 min-w-0 items-center" style={{ background: "var(--color-paper)" }}>
          <svg
            className="absolute left-3.5 text-ink-4 shrink-0"
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
            className="w-full min-w-0 border-0 bg-transparent pl-9 pr-3 py-3.5 sm:py-4 font-[family-name:var(--font-sans)] text-[15px] text-ink placeholder:text-ink-4 outline-none"
            aria-label={`Search facilities in ${stateName}`}
          />
        </div>
        <button
          type="submit"
          className="border-0 px-5 py-3 sm:py-0 font-medium text-[14px] font-[family-name:var(--font-sans)] flex w-full shrink-0 items-center justify-center gap-1.5 sm:w-auto whitespace-nowrap"
          style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}
        >
          Search <span aria-hidden>→</span>
        </button>
      </form>

      {/* Browse all link */}
      <div className="mt-3">
        <Link
          href={`/${stateSlug}/facilities`}
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.08em] text-ink-3 hover:text-ink transition-colors"
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: "var(--color-teal)" }}
            aria-hidden
          />
          Browse all {facilityCount} {stateName} facilities →
        </Link>
      </div>
    </div>
  );
}
