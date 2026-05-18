import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

async function getFacilityCount(stateCode?: string): Promise<number> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return 0;
  let q = supabase
    .from("facilities")
    .select("*", { count: "exact", head: true })
    .eq("publishable", true);
  if (stateCode) q = q.eq("state_code", stateCode);
  const { count } = await q;
  return count ?? 0;
}

type SiteNavProps = {
  /** State code to scope the facility count (e.g. "CA"). Omit for national count. */
  countStateCode?: string;
  /** Badge label shown next to the wordmark. Omit to hide the badge. */
  badge?: string;
  /** CTA href (defaults to "/california"). */
  ctaHref?: string;
  /** CTA aria-label suffix (defaults to "California memory care facilities"). */
  ctaLabel?: string;
  /** When true, shows "States" nav link instead of a state link. */
  national?: boolean;
  /** State hub href for the inline nav link. Defaults to "/california". Label uses `badge`. */
  stateNavHref?: string;
  /** When true, hides the state name nav link (use on the hub page itself to avoid self-links). */
  hideStateLink?: boolean;
};

/**
 * Sticky editorial header with brand mark, nav links, and a live facility-count CTA pill.
 */
export async function SiteNav({
  countStateCode,
  badge = "California",
  ctaHref = "/california",
  ctaLabel = "California memory care facilities",
  national = false,
  stateNavHref = "/california",
  hideStateLink = false,
}: SiteNavProps = {}) {
  const facilityCount = await getFacilityCount(countStateCode);
  const countLabel = facilityCount > 0 ? facilityCount.toLocaleString() : "1,000+";

  return (
    <header className="sticky top-0 z-40 bg-paper border-b border-paper-rule">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-3.5 md:py-[22px] flex flex-nowrap items-center justify-between gap-3 sm:gap-6 min-w-0">

        {/* Brand mark */}
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 no-underline min-w-0 shrink" aria-label="StarlynnCare home">
          {/* Six-arm asterisk mark */}
          <svg viewBox="-50 -50 100 100" className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] shrink-0" aria-hidden fill="currentColor" style={{ color: "var(--color-ink)" }}>
            <g transform="rotate(0)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(60)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(120)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(180)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(240)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(300)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <circle r="3.2"/>
          </svg>
          <span
            className="font-[family-name:var(--font-display)] text-[22px] sm:text-[26px] md:text-[28px] tracking-[-0.01em] text-ink"
          >
            Starlynn<em className="not-italic" style={{ color: "var(--color-rust)" }}>Care</em>
          </span>
          {badge && (
            <span
              className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] border border-rust text-rust px-[7px] py-[3px] rounded-[3px] relative top-[-2px] hidden sm:inline-block"
            >
              {badge}
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-2 sm:gap-5 md:gap-7 text-[14px] md:text-[14.5px] shrink-0" aria-label="Site navigation">
          {national ? (
            <Link href="/states" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
              States
            </Link>
          ) : !hideStateLink && (
            <Link href={stateNavHref} className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
              {badge}
            </Link>
          )}
          <Link href="/data" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
            The Data
          </Link>
          <Link href="/library" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
            Library
          </Link>
          <Link href="/methodology" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
            Methodology
          </Link>
          <Link href="/about" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
            About
          </Link>

          {/* Primary CTA */}
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-teal text-white px-3 py-2 sm:px-[18px] sm:py-[10px] rounded-full text-[12px] sm:text-[14px] font-medium hover:bg-teal-deep transition-colors no-underline whitespace-nowrap"
            aria-label={`Browse ${countLabel} ${ctaLabel}`}
          >
            <span className="sm:hidden">Browse all</span>
            <span className="hidden sm:inline">Browse {countLabel} facilities</span>
            <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
