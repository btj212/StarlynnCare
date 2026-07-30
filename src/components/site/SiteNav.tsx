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
 * Sticky header with brand mark, nav links, and a live facility-count CTA.
 * Clearing visual treatment — labels and routes unchanged.
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
    <header className="sticky top-0 z-40 border-b border-clearing-rule bg-clearing-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] min-w-0 flex-nowrap items-center justify-between gap-3 px-4 py-3.5 sm:gap-6 sm:px-6 md:px-[60px] md:py-[22px]">

        {/* Brand mark */}
        <Link href="/" className="flex min-w-0 shrink items-center gap-2 no-underline sm:gap-2.5" aria-label="StarlynnCare home">
          <svg viewBox="-50 -50 100 100" className="h-[22px] w-[22px] shrink-0 sm:h-6 sm:w-6" aria-hidden fill="currentColor" style={{ color: "var(--color-teal)" }}>
            <g transform="rotate(0)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(60)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(120)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(180)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(240)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <g transform="rotate(300)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
            <circle r="3.2"/>
          </svg>
          <span className="font-[family-name:var(--font-sans)] text-[18px] font-semibold tracking-[-0.02em] text-ink sm:text-[21px]">
            Starlynn<span style={{ color: "var(--color-teal)" }}>Care</span>
          </span>
          {badge && (
            <span className="relative top-[-1px] hidden rounded-full border border-[#C6D6D0] px-2.5 py-[3px] font-[family-name:var(--font-sans)] text-[12px] font-semibold text-teal sm:inline-block">
              {badge}
            </span>
          )}
        </Link>

        {/* Nav — labels unchanged */}
        <nav className="flex shrink-0 items-center gap-2 text-[14px] sm:gap-5 md:gap-7 md:text-[15px]" aria-label="Site navigation">
          {national ? (
            <Link href="/states" className="hidden text-[#3C4A43] no-underline transition-colors hover:text-teal md:inline">
              States
            </Link>
          ) : !hideStateLink && (
            <Link href={stateNavHref} className="hidden text-[#3C4A43] no-underline transition-colors hover:text-teal md:inline">
              {badge}
            </Link>
          )}
          <Link href="/data" className="hidden text-[#3C4A43] no-underline transition-colors hover:text-teal md:inline">
            The Data
          </Link>
          <Link href="/library" className="hidden text-[#3C4A43] no-underline transition-colors hover:text-teal md:inline">
            Library
          </Link>
          <Link href="/methodology" className="hidden text-[#3C4A43] no-underline transition-colors hover:text-teal md:inline">
            Methodology
          </Link>
          <Link href="/about" className="hidden text-[#3C4A43] no-underline transition-colors hover:text-teal md:inline">
            About
          </Link>

          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-teal px-3 py-2 text-[12px] font-semibold text-white no-underline transition-colors hover:bg-teal-deep sm:gap-2 sm:px-5 sm:py-2.5 sm:text-[14.5px]"
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
