import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { HomeResponseForm } from "@/components/facility/HomeResponseForm";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { formatFacilityName } from "@/lib/facility/displayName";
import { canonicalFor } from "@/lib/seo/canonical";
import { stateFromSlug } from "@/lib/states";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ state: string; city: string; facility: string }>;
};

async function loadHome(stateSlug: string, citySlug: string, facilitySlug: string) {
  const state = stateFromSlug(stateSlug);
  const supabase = tryPublicSupabaseClient();
  if (!state || !supabase) return null;
  const { data } = await supabase
    .from("facilities")
    .select("id, name, city, slug, city_slug, state_code")
    .eq("state_code", state.code)
    .eq("city_slug", citySlug)
    .eq("slug", facilitySlug)
    .eq("publishable", true)
    .maybeSingle();
  return data ? { home: data as { id: string; name: string; city: string | null; slug: string; city_slug: string; state_code: string }, state } : null;
}

// A form page for operators. It has nothing for a search engine to index.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state, city, facility } = await params;
  const found = await loadHome(state, city, facility);
  const name = found ? formatFacilityName(found.home.name) : "your home";
  return {
    title: `Confirm the details for ${name} | StarlynnCare`,
    alternates: { canonical: canonicalFor(`/${state}/${city}/${facility}`) },
    robots: { index: false, follow: false },
  };
}

export default async function ConfirmHomePage({ params }: PageProps) {
  const { state: stateSlug, city: citySlug, facility: facilitySlug } = await params;
  const found = await loadHome(stateSlug, citySlug, facilitySlug);
  if (!found) notFound();
  const { home, state } = found;
  const name = formatFacilityName(home.name);
  const profileHref = `/${state.slug}/${home.city_slug}/${home.slug}`;

  return (
    <>
      <GovernanceBar scope={home.state_code} />
      <SiteNav
        countStateCode={home.state_code}
        badge={state.name}
        ctaHref={`/${state.slug}/facilities`}
        ctaLabel={`Browse ${state.name} facilities`}
        stateNavHref={`/${state.slug}`}
      />
      <main className="bg-paper">
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6">
            <p className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-3">
              For the home&rsquo;s operator
            </p>
            <h1
              className="mb-4 font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink"
              style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.08 }}
            >
              Tell families what the state record <em className="text-rust not-italic">cannot.</em>
            </h1>
            <p className="m-0 max-w-[62ch] text-[17px] leading-relaxed text-ink-3">
              This is the listing for{" "}
              <Link href={profileHref} className="font-semibold text-teal underline underline-offset-4">
                {name}
              </Link>
              {home.city ? ` in ${home.city}` : ""}. Answer what you like, in about three minutes. We show your answers on
              the profile as the home&rsquo;s own statements, marked &ldquo;Home-confirmed&rdquo; with the date.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6">
          <ul className="mb-8 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-3">
            <li>It is free. Homes cannot pay for a listing or a better placement.</li>
            <li>We check each answer came from the home before it appears.</li>
            <li>We do not publish openings, and we do not publish your name or email.</li>
            <li>Inspection and citation records stay as the state published them.</li>
          </ul>
          <HomeResponseForm facilityId={home.id} facilityName={name} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
