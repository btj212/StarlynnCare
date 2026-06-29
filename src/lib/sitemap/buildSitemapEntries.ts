import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_ORIGIN } from "@/lib/seo/canonical";
import { regionsForState } from "@/lib/regions";
import { COVERED_STATES } from "@/lib/states";
import { RESEARCH_INDEX } from "@/lib/content/research";

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
    { path: "/states", priority: "0.92", changefreq: "weekly" },
    { path: "/california", priority: "0.9", changefreq: "weekly" },
    { path: "/oregon", priority: "0.88", changefreq: "weekly" },
    { path: "/washington", priority: "0.88", changefreq: "weekly" },
    { path: "/minnesota", priority: "0.88", changefreq: "weekly" },
    { path: "/texas", priority: "0.88", changefreq: "weekly" },
    { path: "/illinois", priority: "0.88", changefreq: "weekly" },
    { path: "/utah", priority: "0.88", changefreq: "weekly" },
    { path: "/arizona", priority: "0.88", changefreq: "weekly" },
    { path: "/missouri", priority: "0.88", changefreq: "weekly" },
    { path: "/methodology", priority: "0.75", changefreq: "monthly" },
    { path: "/about", priority: "0.75", changefreq: "monthly" },
    { path: "/data", priority: "0.8", changefreq: "monthly" },
    { path: "/editorial-policy", priority: "0.72", changefreq: "monthly" },
    { path: "/terms", priority: "0.55", changefreq: "yearly" },
    { path: "/privacy", priority: "0.55", changefreq: "yearly" },
    { path: "/research", priority: "0.85", changefreq: "weekly" },
    ...RESEARCH_INDEX.filter((r) => r.kind === "analysis").map((r) => ({
      path: r.href,
      priority: "0.78",
      changefreq: "monthly" as const,
    })),
    ...RESEARCH_INDEX.filter((r) => r.kind === "flagship-report").map((r) => ({
      path: r.href,
      priority: "0.83",
      changefreq: "monthly" as const,
    })),
    { path: "/library", priority: "0.83", changefreq: "weekly" },
    { path: "/library/type-a-vs-type-b-deficiencies-explained", priority: "0.78", changefreq: "monthly" },
    { path: "/library/memory-care-vs-nursing-home", priority: "0.82", changefreq: "monthly" },
    { path: "/library/medi-cal-and-memory-care", priority: "0.82", changefreq: "monthly" },
    { path: "/library/dementia-vs-alzheimers-vs-lewy-body", priority: "0.78", changefreq: "monthly" },
    { path: "/library/when-is-it-time-for-memory-care", priority: "0.8", changefreq: "monthly" },
    { path: "/library/37-questions-to-ask-on-a-memory-care-tour", priority: "0.82", changefreq: "monthly" },
    { path: "/california/cost-guide", priority: "0.85", changefreq: "monthly" },
    { path: "/california/cost-by-city", priority: "0.84", changefreq: "monthly" },
    { path: "/memory-care-vs-assisted-living", priority: "0.85", changefreq: "monthly" },
    { path: "/california/glossary", priority: "0.78", changefreq: "monthly" },
    { path: "/california/37-questions-to-ask-on-a-tour", priority: "0.78", changefreq: "monthly" },
    // State-specific guides indexes
    { path: "/texas/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/oregon/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/washington/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/minnesota/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/illinois/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/utah/guides", priority: "0.80", changefreq: "monthly" },
    // State facilities browse pages
    ...COVERED_STATES.map((s) => ({
      path: `/${s.slug}/facilities`,
      priority: "0.84",
      changefreq: "weekly" as const,
    })),
    // Texas-specific articles (live)
    { path: "/texas/type-a-b-c-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/texas/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Oregon-specific articles (live)
    { path: "/oregon/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/oregon/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Washington-specific articles (live)
    { path: "/washington/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/washington/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    { path: "/washington/why-dshs-contract-isnt-a-quality-badge", priority: "0.76", changefreq: "monthly" },
    { path: "/washington/how-to-read-our-inspection-data", priority: "0.76", changefreq: "monthly" },
    // Minnesota-specific articles (live)
    { path: "/minnesota/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/minnesota/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Arizona-specific articles (live)
    { path: "/arizona/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/arizona/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    { path: "/arizona/guides", priority: "0.80", changefreq: "monthly" },
    // Missouri hub + guides + articles (live)
    { path: "/missouri", priority: "0.88", changefreq: "weekly" },
    { path: "/missouri/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/missouri/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/missouri/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Pennsylvania hub + guides + articles (live)
    { path: "/pennsylvania", priority: "0.88", changefreq: "weekly" },
    { path: "/pennsylvania/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/pennsylvania/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/pennsylvania/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Pennsylvania insights data stories (live)
    { path: "/pennsylvania/insights", priority: "0.80", changefreq: "monthly" },
    { path: "/pennsylvania/insights/pa-rural-home-highest-immediate-jeopardy", priority: "0.78", changefreq: "monthly" },
    { path: "/pennsylvania/insights/philadelphia-suburbs-worst-records", priority: "0.78", changefreq: "monthly" },
    { path: "/pennsylvania/insights/bigger-not-safer", priority: "0.78", changefreq: "monthly" },
  ];

  return paths.map((p) => ({
    loc: `${SITE_ORIGIN}${p.path}`,
    priority: p.priority,
    changefreq: p.changefreq,
    lastmod: today,
  }));
}

/** Listing hubs for one state: counties + city_slug hubs that match `regionsForState`. */
export async function collectHubEntriesForState(
  supabase: SupabaseClient,
  stateCode: string,
  stateSlug: string,
  today: string,
): Promise<SitemapUrlRow[]> {
  const { data: rows } = await supabase
    .from("facilities")
    .select("city_slug")
    .eq("state_code", stateCode)
    .eq("publishable", true);

  const countBySlug = new Map<string, number>();
  for (const r of rows ?? []) {
    const slug = (r as { city_slug: string }).city_slug;
    if (!slug) continue;
    countBySlug.set(slug, (countBySlug.get(slug) ?? 0) + 1);
  }

  const hubSlugs = new Set<string>();

  for (const region of regionsForState(stateCode)) {
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
      loc: `${SITE_ORIGIN}/${stateSlug}/${slug}`,
      priority: "0.85",
      changefreq: "weekly" as const,
      lastmod: today,
    }));
}

/**
 * California listing hubs — wrapper for backwards compatibility.
 */
export async function collectCaliforniaHubEntries(
  supabase: SupabaseClient,
  today: string,
): Promise<SitemapUrlRow[]> {
  return collectHubEntriesForState(supabase, "CA", "california", today);
}

/** County + city hubs for every covered state (publishable rows drive inclusion). */
export async function collectCoveredStateHubEntries(
  supabase: SupabaseClient,
  today: string,
): Promise<SitemapUrlRow[]> {
  const out: SitemapUrlRow[] = [];
  for (const s of COVERED_STATES) {
    out.push(...(await collectHubEntriesForState(supabase, s.code, s.slug, today)));
  }
  return out;
}

export async function collectFacilityEntriesForState(
  supabase: SupabaseClient,
  stateCode: string,
  stateSlug: string,
  today: string,
): Promise<SitemapUrlRow[]> {
  // Use an inner join on inspections so only facilities with at least one inspection
  // are included. This prevents thin/noindex pages (publishable=true but 0 inspections)
  // from appearing in the sitemap and causing "noindex page in sitemap" Ahrefs errors.
  const { data } = await supabase
    .from("facilities")
    .select("city_slug, slug, updated_at, inspections!facility_id!inner(id)")
    .eq("state_code", stateCode)
    .eq("publishable", true)
    .order("city_slug")
    .order("slug");

  const facilities = (data ?? []) as Array<{
    city_slug: string;
    slug: string;
    updated_at: string;
  }>;

  return facilities.map((f) => ({
    loc: `${SITE_ORIGIN}/${stateSlug}/${f.city_slug}/${f.slug}`,
    priority: "0.8",
    changefreq: "monthly" as const,
    lastmod: f.updated_at ? f.updated_at.split("T")[0] : today,
  }));
}

export async function collectFacilityEntries(
  supabase: SupabaseClient,
  today: string,
): Promise<SitemapUrlRow[]> {
  const out: SitemapUrlRow[] = [];
  for (const s of COVERED_STATES) {
    out.push(...(await collectFacilityEntriesForState(supabase, s.code, s.slug, today)));
  }
  return out;
}
