import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { CompareCard } from "@/components/shortlist/CompareCard";
import { SharedShortlistClient } from "./SharedShortlistClient";
import type { ShortlistItem } from "@/lib/shortlist/context";
import type { CareCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shared Shortlist · StarlynnCare",
  description: "Memory care facilities shortlist shared for review — inspection records side-by-side.",
  robots: { index: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchShortlistItems(ids: string[]): Promise<ShortlistItem[]> {
  if (ids.length === 0) return [];
  const supabase = await tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data: rawFacilities, error: facErr } = await supabase
    .from("facilities")
    .select("id, name, slug, city_slug, state_slug, city, beds, care_category")
    .in("id", ids)
    .eq("publishable", true);

  if (facErr || !rawFacilities || rawFacilities.length === 0) return [];

  const facIds = rawFacilities.map((f) => f.id as string);

  // Inspections — max 10 facilities so no chunking needed
  const { data: inspData } = await supabase
    .from("inspections")
    .select("id, facility_id")
    .in("facility_id", facIds)
    .limit(5000);

  const inspCountByFac = new Map<string, number>();
  const inspFacMap = new Map<string, string>();
  for (const i of inspData ?? []) {
    const iRow = i as { id: string; facility_id: string };
    inspCountByFac.set(iRow.facility_id, (inspCountByFac.get(iRow.facility_id) ?? 0) + 1);
    inspFacMap.set(iRow.id, iRow.facility_id);
  }

  const inspIds = (inspData ?? []).map((i) => (i as { id: string }).id);

  const { data: defData } = await supabase
    .from("deficiencies")
    .select("inspection_id, class, severity")
    .in("inspection_id", inspIds)
    .limit(10000);

  const totalCitByFac = new Map<string, number>();
  const seriousCitByFac = new Map<string, number>();
  for (const d of defData ?? []) {
    const dRow = d as { inspection_id: string; class: string | null; severity: number | null };
    const fid = inspFacMap.get(dRow.inspection_id);
    if (!fid) continue;
    totalCitByFac.set(fid, (totalCitByFac.get(fid) ?? 0) + 1);
    const isSerious = dRow.class === "Type A" || (dRow.severity ?? 0) >= 3;
    if (isSerious) seriousCitByFac.set(fid, (seriousCitByFac.get(fid) ?? 0) + 1);
  }

  return rawFacilities.map((f) => {
    const fRow = f as {
      id: string;
      name: string;
      slug: string;
      city_slug: string;
      state_slug: string;
      city: string | null;
      beds: number | null;
      care_category: CareCategory;
    };
    return {
      id: fRow.id,
      name: fRow.name,
      slug: fRow.slug,
      city_slug: fRow.city_slug,
      state_slug: fRow.state_slug,
      city: fRow.city,
      beds: fRow.beds,
      care_category: fRow.care_category,
      inspections: inspCountByFac.get(fRow.id) ?? 0,
      total_citations: totalCitByFac.get(fRow.id) ?? 0,
      serious_citations: seriousCitByFac.get(fRow.id) ?? 0,
    };
  });
}

export default async function SharedShortlistPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const params = await searchParams;
  const rawIds = params.ids ?? "";

  // Parse, validate, and cap at 10
  const ids = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 10);

  const items = await fetchShortlistItems(ids);

  return (
    <div className="flex flex-col">
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[70vh]" style={{ background: "var(--color-paper)" }}>
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
          <div className="mb-10">
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Shared shortlist
            </div>
            <h1
              className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink"
              style={{ fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1 }}
            >
              {items.length === 0
                ? "No facilities found"
                : (
                  <>
                    {items.length} shortlisted{" "}
                    {items.length === 1 ? "facility" : "facilities"}
                  </>
                )}
            </h1>
            {items.length > 0 && (
              <p className="mt-4 font-[family-name:var(--font-display)] italic text-[18px] text-ink-3">
                Inspection records side-by-side — no commissions, no referral bias.
              </p>
            )}
          </div>

          {items.length === 0 ? (
            <div className="space-y-6 max-w-[52ch]">
              <p className="text-[17px] text-ink-2 leading-relaxed">
                The facilities in this shortlist may no longer be available, or the link may be
                incomplete. Browse all listed facilities to build your own shortlist.
              </p>
              <Link
                href="/california/facilities"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink-2 transition-colors"
              >
                Browse California facilities →
              </Link>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <CompareCard key={item.id} item={item} />
                ))}
              </div>
              <SharedShortlistClient items={items} />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
