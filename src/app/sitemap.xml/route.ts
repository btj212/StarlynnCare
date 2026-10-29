import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import {
  collectCoveredStateHubEntries,
  collectFacilityEntries,
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
    { path: "/sitemap-facilities.xml" },
  ];
  if (supabase) {
    const staticEntries = await stampCoveredStateHubLastmods(
      supabase,
      collectStaticSitemapEntries(),
    );
    const hubs = await collectCoveredStateHubEntries(supabase);
    const facilities = await collectFacilityEntries(supabase);
    children = [
      { path: "/sitemap-static.xml", lastmod: latestContentDate(staticEntries) },
      { path: "/sitemap-hubs.xml", lastmod: latestContentDate(hubs) },
      { path: "/sitemap-facilities.xml", lastmod: latestContentDate(facilities) },
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
