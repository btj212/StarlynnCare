import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

async function getFacilityCount(): Promise<number> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("facilities")
    .select("*", { count: "exact", head: true })
    .eq("publishable", true);
  return count ?? 0;
}

/**
 * Sticky editorial header with brand mark, nav links, and a live facility-count CTA pill.
 */
export async function SiteNav() {
  const facilityCount = await getFacilityCount();
  const countLabel = facilityCount > 0 ? facilityCount.toLocaleString() : "1,000+";

  return (
    <header className="sticky top-0 z-40 bg-paper border-b border-paper-rule">
      <div className="mx-auto max-w-[1280px] px-10 py-[22px] flex items-center justify-between gap-6">

        {/* Brand mark */}
        <Link href="/" className="flex items-baseline gap-2.5 no-underline" aria-label="StarlynnCare home">
          {/* Radial-gradient sphere */}
          <span
            className="inline-block w-[22px] h-[22px] rounded-full relative top-[3px] shrink-0"
            style={{
              background: "radial-gradient(circle at 35% 35%, #C4923B 0 30%, #B8533A 31% 60%, #143F3D 61% 100%)",
              boxShadow: "inset 0 0 0 1px #1A2620",
            }}
            aria-hidden
          />
          <span
            className="font-[family-name:var(--font-display)] text-[28px] tracking-[-0.01em] text-ink"
          >
            Starlynn<em className="not-italic" style={{ color: "var(--color-rust)" }}>Care</em>
          </span>
          <span
            className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] border border-rust text-rust px-[7px] py-[3px] rounded-[3px] relative top-[-2px] hidden sm:inline-block"
          >
            California
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-7 text-[14.5px]" aria-label="Site navigation">
          <Link href="/data" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
            The Data
          </Link>
          <Link href="/methodology" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
            Methodology
          </Link>
          <Link href="/about" className="hidden md:inline text-ink-2 no-underline hover:text-teal transition-colors">
            About
          </Link>

          {/* Primary CTA */}
          <Link
            href="/california"
            className="inline-flex items-center gap-2 bg-teal text-white px-[18px] py-[10px] rounded-full text-[14px] font-medium hover:bg-teal-deep transition-colors no-underline"
          >
            Browse {countLabel} facilities
            <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
