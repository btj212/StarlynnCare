import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { canonicalFor } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Unsubscribe | StarlynnCare",
  alternates: { canonical: canonicalFor("/unsubscribe") },
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <>
      <GovernanceBar />
      <SiteNav badge="" />
      <main className="bg-paper min-h-[60vh] px-4 py-16 md:px-8">
        <div className="mx-auto max-w-[680px]">
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-ink-2 mb-4">
            Unsubscribe
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink">
            Each email has its own off switch.
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
            Use the preferences link in the StarlynnCare email you want to stop. That link turns off one promise — a guide, a facility, an area, or a contract review — and leaves the others alone.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
            If the email is old and has no link, reply to it and name the update you want to stop. We will not unsubscribe you from everything because of one request.
          </p>
          <div className="mt-10">
            <Link
              href="/"
              className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.08em] text-teal underline underline-offset-4"
            >
              ← Back to StarlynnCare
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
