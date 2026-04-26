import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildWebPageWithReviewer } from "@/lib/seo/schema";

const ABOUT_PATH = "/about";
const aboutCanonical = canonicalFor(ABOUT_PATH);
const aboutDesc =
  "We build StarlynnCare as a husband-and-wife team: real California CDSS inspection data for memory care, explained for families. No referral commissions.";

export const metadata: Metadata = {
  title: "About | StarlynnCare",
  description: aboutDesc,
  alternates: { canonical: aboutCanonical },
  openGraph: {
    title: "About | StarlynnCare",
    description: aboutDesc,
    url: aboutCanonical,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "About | StarlynnCare",
    description: aboutDesc,
  },
};

export default function AboutPage() {
  const aboutJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "About", url: aboutCanonical },
    ]),
    buildWebPageWithReviewer({
      name: "About | StarlynnCare",
      url: aboutCanonical,
      description: aboutDesc,
    }),
  ];

  return (
    <>
      <JsonLd objects={aboutJsonLd} />
      <SiteNav />
      <main className="bg-warm-white">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-sc-border">
          <div className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              <Link href="/" className="hover:text-teal transition-colors">
                StarlynnCare
              </Link>{" "}
              · About
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
              About StarlynnCare
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate max-w-[620px]">
              Choosing a care facility for someone you love is one of the hardest
              decisions a family can make — and one of the least transparent.
              We started StarlynnCare to change that.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate max-w-[620px]">
              We&rsquo;re a husband-and-wife team combining decades of frontline
              healthcare experience with the tools and storytelling needed to make
              complex information actually useful. Our goal is simple: help families
              ask the right questions, understand what they&rsquo;re seeing, and
              trust the people they&rsquo;re trusting.
            </p>
          </div>
        </section>

        {/* ── Founders ─────────────────────────────────────────────────────── */}
        <section className="border-b border-sc-border">
          <div className="mx-auto max-w-[1000px] px-6 py-16 md:px-8 md:py-20">
            <div className="grid gap-10 md:grid-cols-2 md:gap-12">

              {/* Star */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-full border-2 border-sc-border bg-sc-border/20 shadow-card">
                  <Image
                    src="/images/about/star.png"
                    alt="Star Lynn Jones, RN — Co-Founder of StarlynnCare"
                    fill
                    className="object-cover object-top"
                    sizes="144px"
                    priority
                  />
                </div>
                <div className="mt-5">
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    Star Lynn Jones, RN
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-teal">
                    Co-Founder
                  </p>
                </div>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
                  <p>
                    Star is a Registered Nurse with a career spent caring for
                    vulnerable people — wound care, immunizations, chronic disease
                    management, and public health case management. As a Nurse Surveyor
                    for the California Department of Public Health, she walked into
                    facilities and saw the violations firsthand: the citations, the
                    patterns, the things families never hear about. StarlynnCare aims
                    to help families access and easily understand this information
                    when they&rsquo;re making important care decisions.
                  </p>
                </div>
              </div>

              {/* Blake */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-full border-2 border-sc-border bg-sc-border/20 shadow-card">
                  <Image
                    src="/images/about/blake-jones.png"
                    alt="Blake Jones — Co-Founder of StarlynnCare"
                    fill
                    className="object-cover object-top"
                    sizes="144px"
                    priority
                  />
                </div>
                <div className="mt-5">
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    Blake Jones
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-teal">
                    Co-Founder
                  </p>
                </div>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
                  <p>
                    Blake is a marketer and storyteller currently pursuing his MBA
                    at UC Berkeley&rsquo;s Haas School of Business, with a focus on
                    operations, marketing, and strategy. He&rsquo;s spent over a
                    decade leading creative production for brands.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Footer CTA ───────────────────────────────────────────────────── */}
        <section>
          <div className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-16">
            <p className="text-base leading-relaxed text-slate">
              Questions, corrections, or just want to talk?{" "}
              <a
                href="mailto:hello@starlynncare.com"
                className="font-medium text-teal underline-offset-4 hover:underline"
              >
                hello@starlynncare.com
              </a>
            </p>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
