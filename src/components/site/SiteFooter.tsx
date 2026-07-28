import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { COVERED_STATES } from "@/lib/states";

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

  const linkCls = "py-1 text-[#9DB6AF] no-underline transition-colors hover:text-white";
  const headingCls =
    "mb-3.5 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-[#C6DAD3]";

  return (
    <footer className="bg-clearing-footer pt-12 pb-8 text-[#9DB6AF]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px]">

        {/* 5-column grid — link inventory unchanged */}
        <div className="mb-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">

          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <svg viewBox="-50 -50 100 100" className="h-[22px] w-[22px] shrink-0" aria-hidden fill="currentColor" style={{ color: "#C6DAD3" }}>
                <g transform="rotate(0)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
                <g transform="rotate(60)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
                <g transform="rotate(120)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
                <g transform="rotate(180)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
                <g transform="rotate(240)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
                <g transform="rotate(300)"><path d="M0,-44 C 5.4,-30 5.4,-14 1.6,-2 C 0.8,-0.6 -0.8,-0.6 -1.6,-2 C -5.4,-14 -5.4,-30 0,-44 Z"/></g>
                <circle r="3.2"/>
              </svg>
              <span className="font-[family-name:var(--font-sans)] text-[21px] font-semibold tracking-[-0.02em] text-white">
                Starlynn<span style={{ color: "#C6DAD3" }}>Care</span>
              </span>
            </div>
            <p className="mb-3 max-w-[36ch] text-[13.5px] leading-relaxed text-[#9DB6AF]">
              An independent civic-data publisher. We index every licensed memory care facility in{" "}
              {COVERED_STATES.map((s) => s.name).join(", ")} against each state&rsquo;s own public inspection record.
            </p>
            <p
              id="no-paid-placement"
              className="max-w-[36ch] font-[family-name:var(--font-mono)] text-[11px] leading-relaxed tracking-[0.06em] text-[#C6DAD3]"
            >
              {GOVERNANCE_24_WORDS}
            </p>
          </div>

          <div>
            <h5 className={headingCls}>The Data</h5>
            <nav className="flex flex-col gap-1 text-[14px]" aria-label="Data links">
              {COVERED_STATES.map((s) => (
                <Link key={s.slug} href={`/${s.slug}`} className={linkCls}>
                  {s.name} facilities
                </Link>
              ))}
              <Link href="/data" className={linkCls}>Dataset overview</Link>
              <Link href="/research" className={linkCls}>Research &amp; analyses</Link>
              <Link href="/llms.txt" className={`${linkCls} flex items-center gap-1`}>
                llms.txt <span className="text-[10px]">↗</span>
              </Link>
            </nav>
          </div>

          <div>
            <h5 className={headingCls}>Library</h5>
            <nav className="flex flex-col gap-1 text-[14px]" aria-label="Editorial library links">
              <Link href="/library" className={linkCls}>All articles</Link>
              <Link href="/california/cost-by-city" className={linkCls}>Cost by city</Link>
              <Link href="/library/memory-care-vs-nursing-home" className={linkCls}>vs. nursing home</Link>
              <Link href="/library/medi-cal-and-memory-care" className={linkCls}>Medi-Cal guide</Link>
              <Link href="/library/when-is-it-time-for-memory-care" className={linkCls}>When to move</Link>
              <Link href="/library/dementia-vs-alzheimers-vs-lewy-body" className={linkCls}>Dementia types</Link>
            </nav>
          </div>

          <div>
            <h5 className={headingCls}>Methodology</h5>
            <nav className="flex flex-col gap-1 text-[14px]" aria-label="Methodology links">
              <Link href="/methodology" className={linkCls}>Our methodology</Link>
              <Link href="/methodology#cdss" className={linkCls}>Source records</Link>
              <Link href="/editorial-policy" className={linkCls}>Editorial policy</Link>
              <Link href="/california/glossary" className={linkCls}>California glossary</Link>
              <Link href="/methodology#no-paid-placement" className={linkCls}>Editorial standards</Link>
              <Link href="/methodology#corrections" className={linkCls}>Corrections policy</Link>
            </nav>
          </div>

          <div>
            <h5 className={headingCls}>About</h5>
            <nav className="flex flex-col gap-1 text-[14px]" aria-label="About links">
              <Link href="/about" className={linkCls}>Our editorial desk</Link>
              <Link href="/california/37-questions-to-ask-on-a-tour" className={linkCls}>Tour checklist (37 questions)</Link>
              <Link href="/about" className={linkCls}>For discharge planners</Link>
              <Link href="/about" className={linkCls}>Press &amp; citations</Link>
            </nav>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-[13.5px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <span>© {year} StarlynnCare, PBC · A California Public Benefit Corporation</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terms" className="transition-colors hover:text-white">Terms of Use</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link>
            <span>{lastRefreshed ? `Last data refresh ${lastRefreshed}` : "Data refreshed weekly"} · CDSS · OR DHS · WA DSHS · HHSC · MDH · DLBC · IDPH · CMS</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
