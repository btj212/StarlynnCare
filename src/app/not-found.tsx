import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ZipSearch } from "@/components/site/ZipSearch";
import { COVERED_STATES } from "@/lib/states";

export const metadata: Metadata = {
  title: "Page not found | StarlynnCare",
  robots: { index: false, follow: true },
};

const TOP_CITIES = [
  { name: "Los Angeles", href: "/california/los-angeles" },
  { name: "Sacramento", href: "/california/sacramento" },
  { name: "San Jose", href: "/california/san-jose" },
  { name: "Portland", href: "/oregon/portland" },
  { name: "Seattle", href: "/washington/seattle" },
];

export default function NotFound() {
  return (
    <>
      <div className="hidden md:block">
        <GovernanceBar scope="national" />
        <SiteNav national ctaHref="/states" ctaLabel="memory care facilities nationwide" />
        <main className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20 md:py-28">

            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust">
              <span className="h-px w-9 bg-rust opacity-60" aria-hidden />
              404 · Page not found
            </div>

            {/* Headline */}
            <h1
              className="font-[family-name:var(--font-display)] font-normal leading-[0.98] tracking-[-0.02em] text-ink mb-6 max-w-[16ch]"
              style={{ fontSize: "clamp(40px, 6vw, 84px)" }}
            >
              That page <em className="italic text-rust">doesn&rsquo;t</em> exist.
            </h1>

            <p className="font-[family-name:var(--font-display)] italic text-[18px] sm:text-[22px] leading-[1.45] text-ink-3 mb-10 max-w-[44ch]">
              Try searching by ZIP code, or browse by state below.
            </p>

            {/* Search */}
            <div className="w-full max-w-[460px] mb-14">
              <ZipSearch variant="editorial" />
            </div>

            {/* State pills */}
            <div className="mb-10">
              <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-ink-3 mb-4">
                States we cover
              </p>
              <div className="flex flex-wrap gap-2">
                {COVERED_STATES.map((s) => (
                  <Link
                    key={s.code}
                    href={`/${s.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-[7px] border border-paper-rule bg-paper-2 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-ink-2 hover:border-teal hover:text-teal transition-colors no-underline"
                  >
                    <span className="text-rust font-semibold">{s.code}</span>
                    <span>{s.name}</span>
                    <span className="text-ink-4">→</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Top cities */}
            <div>
              <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-ink-3 mb-4">
                Popular starting points
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {TOP_CITIES.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="font-[family-name:var(--font-display)] text-[17px] italic text-teal hover:underline underline-offset-4 no-underline"
                  >
                    {c.name} →
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>

      {/* Mobile */}
      <div className="m-app md:hidden">
        <header className="m-topbar">
          <div className="m-topbar-row">
            <Link href="/" className="m-brand no-underline text-ink" aria-label="StarlynnCare home">
              <span className="mark" aria-hidden />
              <span>
                Starlynn<em className="not-italic" style={{ color: "var(--color-rust)" }}>Care</em>
              </span>
            </Link>
          </div>
          <ZipSearch variant="mobileShell" />
        </header>

        <main>
          <section className="m-hero">
            <div className="eyebrow">404 · Not Found</div>
            <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.015em", margin: "0 0 14px" }}>
              That page <em>doesn&rsquo;t</em> exist.
            </h1>
            <p className="deck">Try searching by ZIP, or pick a state below.</p>
          </section>

          <div className="px-[18px] py-5 flex flex-col gap-3">
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-ink-3">
              States we cover
            </p>
            <div className="flex flex-wrap gap-2">
              {COVERED_STATES.map((s) => (
                <Link
                  key={s.code}
                  href={`/${s.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-paper-rule bg-paper-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-2 no-underline"
                >
                  <span className="text-rust font-semibold">{s.code}</span>
                  <span>{s.name}</span>
                </Link>
              ))}
            </div>

            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-ink-3 mt-4">
              Popular cities
            </p>
            <div className="flex flex-col gap-2">
              {TOP_CITIES.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="font-[family-name:var(--font-display)] text-[16px] italic text-teal no-underline"
                >
                  {c.name} →
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
