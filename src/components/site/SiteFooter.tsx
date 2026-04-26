import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

async function getLastRefreshed(): Promise<string | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("facilities")
    .select("updated_at")
    .eq("publishable", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (!data?.updated_at) return null;
  const d = new Date(data.updated_at as string);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 4-column editorial footer with brand description, data links, methodology links, and about links.
 */
export async function SiteFooter() {
  const lastRefreshed = await getLastRefreshed();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-paper border-t-2 border-ink pt-12 pb-8">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10">

        {/* 4-column grid */}
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] mb-10">

          {/* Brand block */}
          <div>
            <div className="flex items-baseline gap-2.5 mb-4">
              <span
                className="inline-block w-[20px] h-[20px] rounded-full relative top-[2px] shrink-0"
                style={{
                  background: "radial-gradient(circle at 35% 35%, #C4923B 0 30%, #B8533A 31% 60%, #143F3D 61% 100%)",
                  boxShadow: "inset 0 0 0 1px #1A2620",
                }}
                aria-hidden
              />
              <span className="font-[family-name:var(--font-display)] text-[24px] text-ink">
                Starlynn<em className="not-italic" style={{ color: "var(--color-rust)" }}>Care</em>
              </span>
            </div>
            <p className="text-[13.5px] text-ink-3 leading-relaxed max-w-[36ch] mb-3">
              An independent civic-data publisher. We grade every licensed memory care facility in
              California against the state&rsquo;s own public inspection record.
            </p>
            <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] text-rust">
              No referral fees. No paid placement. Period.
            </p>
          </div>

          {/* The Data */}
          <div>
            <h5 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust font-semibold mb-3.5">
              The Data
            </h5>
            <nav className="flex flex-col gap-1 text-[14px]" aria-label="Data links">
              <Link href="/california" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">All California facilities</Link>
              <Link href="/california" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">By county (4 live)</Link>
              <Link href="/data" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">Dataset overview</Link>
              <Link href="/llms.txt" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors flex items-center gap-1">
                llms.txt <span className="text-rust text-[10px]">↗</span>
              </Link>
            </nav>
          </div>

          {/* Methodology */}
          <div>
            <h5 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust font-semibold mb-3.5">
              Methodology
            </h5>
            <nav className="flex flex-col gap-1 text-[14px]" aria-label="Methodology links">
              <Link href="/methodology" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">How we grade</Link>
              <Link href="/methodology#cdss" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">Source records (CDSS)</Link>
              <Link href="/methodology#no-paid-placement" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">Editorial standards</Link>
              <Link href="/methodology#corrections" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">Corrections policy</Link>
            </nav>
          </div>

          {/* About */}
          <div>
            <h5 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust font-semibold mb-3.5">
              About
            </h5>
            <nav className="flex flex-col gap-1 text-[14px]" aria-label="About links">
              <Link href="/about" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">Our editorial desk</Link>
              <Link href="/about" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">For discharge planners</Link>
              <Link href="/about" className="py-1 text-ink-2 no-underline hover:text-teal transition-colors">Press &amp; citations</Link>
            </nav>
          </div>
        </div>

        {/* Foot meta */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-6 border-t border-paper-rule font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] text-ink-4 sm:flex-wrap sm:gap-3">
          <span>© {year} StarlynnCare, PBC · A California Public Benefit Corporation</span>
          <span>
            {lastRefreshed ? `Last data refresh ${lastRefreshed}` : "Data refreshed weekly"} · CDSS · CMS Care Compare
          </span>
        </div>
      </div>
    </footer>
  );
}
