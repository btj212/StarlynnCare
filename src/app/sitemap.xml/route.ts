import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { COVERED_STATES } from "@/lib/states";
import {
  collectCoveredStateHubEntries,
  collectFacilityEntriesForState,
  collectStaticSitemapEntries,
  latestContentDate,
  renderSitemapIndex,
  stampCoveredStateHubLastmods,
  type SitemapIndexEntry,
} from "@/lib/sitemap/buildSitemapEntries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const supabase = tryPublicSupabaseClient();
  let children: SitemapIndexEntry[] = [
    { path: "/sitemap-static.xml" },
    { path: "/sitemap-hubs.xml" },
    ...COVERED_STATES.map((s) => ({ path: `/sitemap-facilities-${s.slug}.xml` })),
  ];
  if (supabase) {
    const staticEntries = await stampCoveredStateHubLastmods(
      supabase,
      collectStaticSitemapEntries(),
    );
    const hubs = await collectCoveredStateHubEntries(supabase);
    // One file per state so Search Console's sitemap filter shows indexing per state.
    const facilityChildren: SitemapIndexEntry[] = [];
    for (const s of COVERED_STATES) {
      const entries = await collectFacilityEntriesForState(supabase, s.code, s.slug);
      if (entries.length === 0) continue;
      facilityChildren.push({
        path: `/sitemap-facilities-${s.slug}.xml`,
        lastmod: latestContentDate(entries),
      });
    }
    children = [
      { path: "/sitemap-static.xml", lastmod: latestContentDate(staticEntries) },
      { path: "/sitemap-hubs.xml", lastmod: latestContentDate(hubs) },
      ...facilityChildren,
    ];
  }
  const xml = renderSitemapIndex(children);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
