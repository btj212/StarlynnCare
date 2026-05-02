import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE = "https://www.starlynncare.com";

// City pages we want explicitly in the sitemap (priority hubs)
const CITY_PAGES = [
  "alameda-county",
  "contra-costa-county",
  "san-mateo-county",
  "santa-clara-county",
  "los-angeles-county",
  "san-diego-county",
  "orange-county",
  "sacramento-county",
  "oakland",
  "berkeley",
  "alameda",
  "fremont",
  "hayward",
  "livermore",
  "pleasanton",
  "albany",
  "castro-valley",
];

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  // Fetch all publishable facilities for their canonical URLs
  const supabase = tryPublicSupabaseClient();
  type FacilitySlugRow = { city_slug: string; slug: string; updated_at: string };
  let facilities: FacilitySlugRow[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("facilities")
      .select("city_slug, slug, updated_at")
      .eq("state_code", "CA")
      .eq("publishable", true)
      .order("city_slug")
      .order("slug");
    facilities = (data ?? []) as FacilitySlugRow[];
  }

  const staticUrls = [
    { loc: SITE, priority: "1.0", changefreq: "weekly" as const },
    { loc: `${SITE}/california`, priority: "0.9", changefreq: "weekly" as const },
    { loc: `${SITE}/methodology`, priority: "0.75", changefreq: "monthly" as const },
    { loc: `${SITE}/about`, priority: "0.75", changefreq: "monthly" as const },
    { loc: `${SITE}/data`, priority: "0.8", changefreq: "monthly" as const },
    { loc: `${SITE}/library/type-a-vs-type-b-deficiencies-explained`, priority: "0.78", changefreq: "monthly" as const },
    { loc: `${SITE}/library/memory-care-cost-california`, priority: "0.78", changefreq: "monthly" as const },
    ...CITY_PAGES.map((slug) => ({
      loc: `${SITE}/california/${slug}`,
      priority: "0.85",
      changefreq: "weekly" as const,
    })),
  ];

  const citySlugs = [...new Set(facilities.map((f) => f.city_slug))].sort();
  const cityHubUrls = citySlugs.map((slug) => ({
    loc: `${SITE}/california/${slug}`,
    priority: "0.85",
    changefreq: "weekly" as const,
  }));

  const facilityUrls = facilities.map((f) => ({
    loc: `${SITE}/california/${f.city_slug}/${f.slug}`,
    priority: "0.8",
    changefreq: "monthly" as const,
    lastmod: f.updated_at ? f.updated_at.split("T")[0] : today,
  }));

  const seen = new Set<string>();
  const allUrls: Array<{
    loc: string;
    priority: string;
    changefreq: string;
    lastmod?: string;
  }> = [];
  for (const u of [...staticUrls, ...cityHubUrls, ...facilityUrls]) {
    if (seen.has(u.loc)) continue;
    seen.add(u.loc);
    allUrls.push(u);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${("lastmod" in u && u.lastmod) ? u.lastmod : today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
