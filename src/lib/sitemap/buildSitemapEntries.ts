import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_ORIGIN } from "@/lib/seo/canonical";
import { regionsForState } from "@/lib/regions";

export type SitemapUrlRow = {
  loc: string;
  priority: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  lastmod?: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderUrlset(entries: SitemapUrlRow[], today: string): string {
  const body = entries
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod ?? today)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function renderSitemapIndex(childPaths: string[], today: string): string {
  const body = childPaths
    .map(
      (path) => `  <sitemap>
    <loc>${escapeXml(`${SITE_ORIGIN}${path}`)}</loc>
    <lastmod>${escapeXml(today)}</lastmod>
  </sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

/** Marketing + editorial URLs (no county/city hubs, no facility profiles). */
export function collectStaticSitemapEntries(today: string): SitemapUrlRow[] {
  const paths: Array<{ path: string; priority: string; changefreq: SitemapUrlRow["changefreq"] }> = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/california", priority: "0.9", changefreq: "weekly" },
    { path: "/methodology", priority: "0.75", changefreq: "monthly" },
    { path: "/about", priority: "0.75", changefreq: "monthly" },
    { path: "/data", priority: "0.8", changefreq: "monthly" },
    { path: "/editorial-policy", priority: "0.72", changefreq: "monthly" },
    { path: "/terms", priority: "0.55", changefreq: "yearly" },
    { path: "/privacy", priority: "0.55", changefreq: "yearly" },
    { path: "/library/type-a-vs-type-b-deficiencies-explained", priority: "0.78", changefreq: "monthly" },
    { path: "/library/memory-care-vs-nursing-home", priority: "0.82", changefreq: "monthly" },
    { path: "/library/medi-cal-and-memory-care", priority: "0.82", changefreq: "monthly" },
    { path: "/library/dementia-vs-alzheimers-vs-lewy-body", priority: "0.78", changefreq: "monthly" },
    { path: "/library/when-is-it-time-for-memory-care", priority: "0.8", changefreq: "monthly" },
    { path: "/california/cost-guide", priority: "0.85", changefreq: "monthly" },
    { path: "/california/cost-by-city", priority: "0.84", changefreq: "monthly" },
    { path: "/memory-care-vs-assisted-living", priority: "0.85", changefreq: "monthly" },
    { path: "/california/glossary", priority: "0.78", changefreq: "monthly" },
    { path: "/california/37-questions-to-ask-on-a-tour", priority: "0.78", changefreq: "monthly" },
  ];

  return paths.map((p) => ({
    loc: `${SITE_ORIGIN}${p.path}`,
    priority: p.priority,
    changefreq: p.changefreq,
    lastmod: today,
  }));
}

/**
 * California listing hubs: counties with ≥1 publishable facility across seed cities,
 * plus every city_slug that has ≥1 publishable facility (matches hub routing).
 */
export async function collectCaliforniaHubEntries(
  supabase: SupabaseClient,
  today: string,
): Promise<SitemapUrlRow[]> {
  const { data: rows } = await supabase
    .from("facilities")
    .select("city_slug")
    .eq("state_code", "CA")
    .eq("publishable", true);

  const countBySlug = new Map<string, number>();
  for (const r of rows ?? []) {
    const slug = (r as { city_slug: string }).city_slug;
    if (!slug) continue;
    countBySlug.set(slug, (countBySlug.get(slug) ?? 0) + 1);
  }

  const hubSlugs = new Set<string>();

  for (const region of regionsForState("CA")) {
    if (region.kind !== "county") continue;
    const n = region.citySlugs.reduce((acc, s) => acc + (countBySlug.get(s) ?? 0), 0);
    if (n > 0) hubSlugs.add(region.slug);
  }

  for (const slug of countBySlug.keys()) {
    hubSlugs.add(slug);
  }

  return [...hubSlugs]
    .sort()
    .map((slug) => ({
      loc: `${SITE_ORIGIN}/california/${slug}`,
      priority: "0.85",
      changefreq: "weekly" as const,
      lastmod: today,
    }));
}

export async function collectFacilityEntries(
  supabase: SupabaseClient,
  today: string,
): Promise<SitemapUrlRow[]> {
  const { data } = await supabase
    .from("facilities")
    .select("city_slug, slug, updated_at")
    .eq("state_code", "CA")
    .eq("publishable", true)
    .order("city_slug")
    .order("slug");

  const facilities = (data ?? []) as Array<{
    city_slug: string;
    slug: string;
    updated_at: string;
  }>;

  return facilities.map((f) => ({
    loc: `${SITE_ORIGIN}/california/${f.city_slug}/${f.slug}`,
    priority: "0.8",
    changefreq: "monthly" as const,
    lastmod: f.updated_at ? f.updated_at.split("T")[0] : today,
  }));
}
