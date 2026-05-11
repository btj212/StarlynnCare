import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildStateHubCollectionPage, buildWebPageWithReviewer } from "@/lib/seo/schema";
import { stateFromSlug } from "@/lib/states";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { FacilityListClient, type ListFacility } from "@/components/facility/FacilityListClient";
import { REGULATOR_ABBR, clipMetaDescription } from "@/lib/seo/meta";
import type { CareCategory } from "@/lib/types";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ state: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const state = stateFromSlug(stateSlug);
  if (!state) return { title: "State not found | StarlynnCare" };

  const canonical = canonicalFor(`/${state.slug}/facilities`);
  const reg = REGULATOR_ABBR[state.code] ?? "state";
  const desc = clipMetaDescription(
    `Browse every licensed memory care facility in ${state.name} — searchable and filtered by size, citation history, and care type. Independent ${reg} data, no commissions.`,
  );

  return {
    title: `All memory care facilities in ${state.name} | StarlynnCare`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: `All memory care facilities in ${state.name} | StarlynnCare`,
      description: desc,
      url: canonical,
      type: "website",
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `All memory care facilities in ${state.name} | StarlynnCare`,
      description: desc,
      images: ["/og-default.png"],
    },
  };
}

export default async function StateFacilitiesPage({ params }: PageProps) {
  const { state: stateSlug } = await params;
  const state = stateFromSlug(stateSlug);
  if (!state) notFound();

  const supabase = tryPublicSupabaseClient();
  let facilities: ListFacility[] = [];
  let fetchError: string | null = null;

  if (!supabase) {
    fetchError = "Supabase is not configured.";
  } else {
    const { data: rawFacilities, error } = await supabase
      .from("facilities")
      .select(
        "id, name, city, street, zip, city_slug, slug, beds, care_category, photo_url, serves_memory_care, memory_care_disclosure_filed, tx_alzheimer_certified, capacity_tier",
      )
      .eq("state_code", state.code)
      .eq("publishable", true)
      .order("name", { ascending: true })
      .limit(2000);

    if (error) {
      fetchError = error.message;
    } else {
      const raw = (rawFacilities ?? []) as Array<{
        id: string;
        name: string;
        city: string | null;
        street: string | null;
        zip: string | null;
        city_slug: string;
        slug: string;
        beds: number | null;
        care_category: string;
        photo_url: string | null;
        serves_memory_care: boolean;
        memory_care_disclosure_filed: boolean;
        tx_alzheimer_certified: boolean | null;
        capacity_tier: "small" | "medium" | "large" | "unknown";
      }>;

      if (raw.length > 0) {
        const ids = raw.map((f) => f.id);

        // Inspections
        const { data: inspData, error: inspErr } = await supabase
          .from("inspections")
          .select("id, facility_id")
          .in("facility_id", ids);

        if (inspErr) {
          console.error("[facilities] inspections query failed:", inspErr.message);
        }

        const inspCountByFac = new Map<string, number>();
        const inspFacMap = new Map<string, string>();
        for (const i of inspData ?? []) {
          inspCountByFac.set(i.facility_id, (inspCountByFac.get(i.facility_id) ?? 0) + 1);
          inspFacMap.set(i.id, i.facility_id);
        }

        const inspIds = (inspData ?? []).map((i: { id: string }) => i.id);

        // Deficiencies — chunked to avoid URL-length limits
        const DEF_CHUNK = 150;
        const allDefs: Array<{ inspection_id: string; class: string | null; severity: number | null }> = [];
        for (let ci = 0; ci < inspIds.length; ci += DEF_CHUNK) {
          const chunk = inspIds.slice(ci, ci + DEF_CHUNK);
          const { data: chunkData, error: chunkErr } = await supabase
            .from("deficiencies")
            .select("inspection_id, class, severity")
            .in("inspection_id", chunk)
            .limit(5000);
          if (chunkErr) {
            console.error("[facilities] deficiencies chunk failed:", chunkErr.message);
            break;
          }
          if (chunkData) allDefs.push(...(chunkData as typeof allDefs));
        }

        const totalCitByFac = new Map<string, number>();
        const seriousCitByFac = new Map<string, number>();
        for (const d of allDefs) {
          const fid = inspFacMap.get(d.inspection_id);
          if (!fid) continue;
          totalCitByFac.set(fid, (totalCitByFac.get(fid) ?? 0) + 1);
          const isSerious = d.class === "Type A" || (d.severity ?? 0) >= 3;
          if (isSerious) seriousCitByFac.set(fid, (seriousCitByFac.get(fid) ?? 0) + 1);
        }

        facilities = raw.map((f) => ({
          id: f.id,
          name: f.name,
          city: f.city,
          street: f.street,
          zip: f.zip,
          city_slug: f.city_slug,
          slug: f.slug,
          beds: f.beds,
          care_category: f.care_category as CareCategory,
          photo_url: f.photo_url,
          serves_memory_care: f.serves_memory_care,
          memory_care_disclosure_filed: f.memory_care_disclosure_filed,
          tx_alzheimer_certified: f.tx_alzheimer_certified ?? undefined,
          capacity_tier: f.capacity_tier,
          inspections: inspCountByFac.get(f.id) ?? 0,
          serious_citations: seriousCitByFac.get(f.id) ?? 0,
          total_citations: totalCitByFac.get(f.id) ?? 0,
        }));
      }
    }
  }

  const hiddenSmallCount = facilities.filter((f) => f.capacity_tier === "small").length;
  const nonSmallCount = facilities.length - hiddenSmallCount;

  const pageCanonical = canonicalFor(`/${state.slug}/facilities`);
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: `${state.name} memory care`, url: canonicalFor(`/${state.slug}`) },
      { name: "All facilities", url: pageCanonical },
    ]),
    buildStateHubCollectionPage({
      name: `Memory care facilities in ${state.name}`,
      url: pageCanonical,
      state,
    }),
    buildWebPageWithReviewer({
      name: `All memory care facilities in ${state.name} | StarlynnCare`,
      url: pageCanonical,
      description: `Browse every licensed memory care facility in ${state.name}, searchable by name, city, and citation history.`,
    }),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar scope={state.code} />
      <SiteNav
        countStateCode={state.code}
        badge={state.name}
        ctaHref={`/${state.slug}`}
        ctaLabel={`${state.name} overview`}
      />
      <main style={{ background: "var(--color-paper)" }}>
        {/* ── Header ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust mb-3">
              {state.name} · All facilities
            </p>
            <h1
              className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink mb-4"
              style={{ fontSize: "clamp(36px, 4.5vw, 58px)", lineHeight: 1.05 }}
            >
              {state.name} — <em className="text-rust not-italic">every licensed facility,</em>
              <br />documented in the public record.
            </h1>
            <p className="font-[family-name:var(--font-display)] italic text-[18px] leading-[1.5] text-ink-3 max-w-[52ch] mt-3">
              Search, filter, and compare every publishable memory care facility in {state.name}.
              Rankings built from state inspection data — no referral commissions, no paid placement.
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-6 border-l-2 border-teal pl-5 font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-[0.04em]">
              <span>
                <strong className="font-semibold text-ink text-[18px]">{nonSmallCount}</strong>{" "}
                {nonSmallCount === 1 ? "facility" : "facilities"} indexed
              </span>
              {hiddenSmallCount > 0 && (
                <span className="text-ink-4">+ {hiddenSmallCount} small care homes</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Facility list ── */}
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 pb-20">
          {fetchError && (
            <div className="mt-10 border border-gold/30 bg-gold-soft px-5 py-4 text-sm">
              <p className="font-semibold text-gold">Configuration</p>
              <p className="mt-2 text-ink-2">{fetchError}</p>
            </div>
          )}
          <FacilityListClient
            facilities={facilities}
            stateSlug={state.slug}
            regionName={state.name}
            hiddenSmallCount={hiddenSmallCount}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
