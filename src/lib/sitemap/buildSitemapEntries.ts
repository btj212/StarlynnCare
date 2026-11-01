import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_ORIGIN } from "@/lib/seo/canonical";
import {
  azSmallHomeWithoutCitations,
  facilityListedInSitemap,
} from "@/lib/seo/indexability";
import { regionsForState } from "@/lib/regions";
import { COVERED_STATES } from "@/lib/states";
import { RESEARCH_INDEX } from "@/lib/content/research";

export type SitemapUrlRow = {
  loc: string;
  priority: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  lastmod?: string;
};

const SITEMAP_QUERY_PAGE_SIZE = 1000;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderUrlset(entries: SitemapUrlRow[]): string {
  const body = entries
    .map((u) => {
      // A missing date stays omitted. Substituting the generation date made
      // unchanged pages look freshly edited every day.
      const lastmod = u.lastmod
        ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>`
        : "";
      return `  <url>
    <loc>${escapeXml(u.loc)}</loc>${lastmod}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export type SitemapIndexEntry = {
  path: string;
  /** Omitted when the child file has no real content date. */
  lastmod?: string;
};

/** Newest real content date in a child sitemap. Generation day is not a date. */
export function latestContentDate(entries: SitemapUrlRow[]): string | undefined {
  let latest = "";
  for (const entry of entries) {
    if (entry.lastmod && entry.lastmod > latest) latest = entry.lastmod;
  }
  return latest || undefined;
}

export function renderSitemapIndex(children: SitemapIndexEntry[]): string {
  const body = children
    .map((child) => {
      // The index used to stamp every child with the generation day, so Google
      // was told the sitemap changed even when no page in it had changed.
      const lastmod = child.lastmod
        ? `\n    <lastmod>${escapeXml(child.lastmod)}</lastmod>`
        : "";
      return `  <sitemap>
    <loc>${escapeXml(`${SITE_ORIGIN}${child.path}`)}</loc>${lastmod}
  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

/** Marketing + editorial URLs (no county/city hubs, no facility profiles). */
export function collectStaticSitemapEntries(): SitemapUrlRow[] {
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
    { path: "/library/choosing-memory-care", priority: "0.84", changefreq: "monthly" },
    { path: "/library/type-a-vs-type-b-deficiencies-explained", priority: "0.78", changefreq: "monthly" },
    { path: "/library/what-a-serious-citation-means", priority: "0.78", changefreq: "monthly" },
    { path: "/library/the-first-72-hours", priority: "0.78", changefreq: "monthly" },
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
    { path: "/california/how-to-check-a-memory-care-record", priority: "0.78", changefreq: "monthly" },
    { path: "/california/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    // State-specific guides indexes
    { path: "/texas/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/oregon/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/washington/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/minnesota/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/illinois/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/illinois/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/illinois/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    { path: "/utah/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/utah/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    // State facilities browse pages
    ...COVERED_STATES.map((s) => ({
      path: `/${s.slug}/facilities`,
      priority: "0.84",
      changefreq: "weekly" as const,
    })),
    // Texas-specific articles (live)
    { path: "/texas/type-a-b-c-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/texas/is-it-licensed-for-memory-care", priority: "0.78", changefreq: "monthly" },
    { path: "/texas/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Oregon-specific articles (live)
    { path: "/oregon/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/oregon/is-it-licensed-for-memory-care", priority: "0.78", changefreq: "monthly" },
    { path: "/oregon/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Washington-specific articles (live)
    { path: "/washington/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/washington/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    { path: "/washington/why-dshs-contract-isnt-a-quality-badge", priority: "0.76", changefreq: "monthly" },
    { path: "/washington/how-to-read-our-inspection-data", priority: "0.76", changefreq: "monthly" },
    { path: "/washington/how-to-check-a-memory-care-record", priority: "0.78", changefreq: "monthly" },
    // Minnesota-specific articles (live)
    { path: "/minnesota/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/minnesota/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Arizona-specific articles (live)
    { path: "/arizona/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/arizona/how-to-check-a-memory-care-record", priority: "0.78", changefreq: "monthly" },
    { path: "/arizona/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    { path: "/arizona/guides", priority: "0.80", changefreq: "monthly" },
    // Missouri guides + articles. The state hub itself is listed once above.
    { path: "/missouri/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/missouri/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/missouri/is-it-licensed-for-memory-care", priority: "0.78", changefreq: "monthly" },
    { path: "/missouri/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    { path: "/colorado", priority: "0.88", changefreq: "weekly" },
    { path: "/colorado/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/colorado/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/colorado/memory-care-vs-nursing-home", priority: "0.78", changefreq: "monthly" },
    // Pennsylvania hub + guides + articles (live)
    { path: "/pennsylvania", priority: "0.88", changefreq: "weekly" },
    { path: "/pennsylvania/guides", priority: "0.80", changefreq: "monthly" },
    { path: "/pennsylvania/memory-care-licensing", priority: "0.78", changefreq: "monthly" },
    { path: "/pennsylvania/is-it-licensed-for-memory-care", priority: "0.78", changefreq: "monthly" },
    { path: "/pennsylvania/how-to-check-a-memory-care-record", priority: "0.78", changefreq: "monthly" },
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
  }));
}

/**
 * State hubs are static URLs, but their content changes when facility data
 * changes. Stamp each one with that state's newest publishable `updated_at`
 * instead of the sitemap generation date.
 */
export async function stampCoveredStateHubLastmods(
  supabase: SupabaseClient,
  entries: SitemapUrlRow[],
): Promise<SitemapUrlRow[]> {
  const stateByPath = new Map(COVERED_STATES.map((state) => [`/${state.slug}`, state.code]));
  const latestByCode = new Map<string, string>();

  for (let from = 0; ; from += SITEMAP_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("facilities")
      .select("id, state_code, updated_at")
      .eq("publishable", true)
      .order("id")
      .range(from, from + SITEMAP_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to date state hub sitemap entries: ${error.message}`);
    }

    const page = (data ?? []) as Array<{
      id: string;
      state_code: string;
      updated_at: string | null;
    }>;
    for (const row of page) {
      const updated = row.updated_at?.split("T")[0];
      if (updated && updated > (latestByCode.get(row.state_code) ?? "")) {
        latestByCode.set(row.state_code, updated);
      }
    }
    if (page.length < SITEMAP_QUERY_PAGE_SIZE) break;
  }

  return entries.map((entry) => {
    const stateCode = stateByPath.get(entry.loc.slice(SITE_ORIGIN.length));
    const lastmod = stateCode ? latestByCode.get(stateCode) : undefined;
    return lastmod ? { ...entry, lastmod } : entry;
  });
}

/** Listing hubs for one state: counties + city_slug hubs that match `regionsForState`. */
export async function collectHubEntriesForState(
  supabase: SupabaseClient,
  stateCode: string,
  stateSlug: string,
): Promise<SitemapUrlRow[]> {
  type HubFacilityRow = {
    id: string;
    city_slug: string;
    updated_at: string | null;
    beds: number | null;
  };

  const rows: HubFacilityRow[] = [];
  for (let from = 0; ; from += SITEMAP_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("facilities")
      .select("id, city_slug, updated_at, beds")
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .order("id")
      .range(from, from + SITEMAP_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to build ${stateCode} hub sitemap entries: ${error.message}`);
    }

    const page = (data ?? []) as HubFacilityRow[];
    rows.push(...page);
    if (page.length < SITEMAP_QUERY_PAGE_SIZE) break;
  }

  const smallArizonaIds =
    stateCode === "AZ"
      ? rows
          .filter((facility) => azSmallHomeWithoutCitations(stateCode, facility.beds, 0))
          .map((facility) => facility.id)
      : [];
  const citedSmallHomes = await azSmallHomesThatHaveCitations(supabase, smallArizonaIds);
  const indexableBySlug = new Map<string, number>();
  const countBySlug = new Map<string, number>();
  const lastmodBySlug = new Map<string, string>();
  for (const r of rows) {
    const slug = r.city_slug;
    if (!slug) continue;
    countBySlug.set(slug, (countBySlug.get(slug) ?? 0) + 1);
    const excluded = azSmallHomeWithoutCitations(
      stateCode,
      r.beds,
      citedSmallHomes.has(r.id) ? 1 : 0,
    );
    if (!excluded) indexableBySlug.set(slug, (indexableBySlug.get(slug) ?? 0) + 1);
    const updated = r.updated_at?.split("T")[0];
    if (updated && updated > (lastmodBySlug.get(slug) ?? "")) {
      lastmodBySlug.set(slug, updated);
    }
  }

  const hubLastmod = new Map<string, string>();

  for (const region of regionsForState(stateCode)) {
    if (region.kind !== "county") continue;
    const n = region.citySlugs.reduce((acc, s) => acc + (indexableBySlug.get(s) ?? 0), 0);
    if (n === 0) continue;

    const latest = region.citySlugs.reduce(
      (max, slug) => {
        const updated = lastmodBySlug.get(slug);
        return updated && updated > max ? updated : max;
      },
      "",
    );
    hubLastmod.set(region.slug, latest);
  }

  for (const slug of countBySlug.keys()) {
    // A city whose homes are all excluded Arizona pages cannot justify a hub URL.
    if ((indexableBySlug.get(slug) ?? 0) === 0) continue;
    hubLastmod.set(slug, lastmodBySlug.get(slug) ?? "");
  }

  return [...hubLastmod]
    .sort()
    .map(([slug, lastmod]) => ({
      loc: `${SITE_ORIGIN}/${stateSlug}/${slug}`,
      priority: "0.85",
      changefreq: "weekly" as const,
      ...(lastmod ? { lastmod } : {}),
    }));
}

/**
 * California listing hubs — wrapper for backwards compatibility.
 */
export async function collectCaliforniaHubEntries(
  supabase: SupabaseClient,
): Promise<SitemapUrlRow[]> {
  return collectHubEntriesForState(supabase, "CA", "california");
}

/** County + city hubs for every covered state (publishable rows drive inclusion). */
export async function collectCoveredStateHubEntries(
  supabase: SupabaseClient,
): Promise<SitemapUrlRow[]> {
  const out: SitemapUrlRow[] = [];
  for (const s of COVERED_STATES) {
    out.push(...(await collectHubEntriesForState(supabase, s.code, s.slug)));
  }
  return out;
}

/** Small Arizona homes with no citations are noindexed, so they stay out of the sitemap. */
async function azSmallHomesThatHaveCitations(
  supabase: SupabaseClient,
  facilityIds: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let index = 0; index < facilityIds.length; index += 80) {
    const chunk = facilityIds.slice(index, index + 80);
    let lastId = "";
    for (;;) {
      let query = supabase
        .from("inspections")
        .select("id, facility_id, deficiencies!inner(id)")
        .in("facility_id", chunk)
        .order("id")
        .limit(1000);
      if (lastId) query = query.gt("id", lastId);
      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to check Arizona citations: ${error.message}`);
      }
      const rows = (data ?? []) as Array<{ id: string; facility_id: string }>;
      for (const row of rows) found.add(row.facility_id);
      if (rows.length < 1000) break;
      lastId = rows[rows.length - 1].id;
    }
  }
  return found;
}

export async function collectFacilityEntriesForState(
  supabase: SupabaseClient,
  stateCode: string,
  stateSlug: string,
): Promise<SitemapUrlRow[]> {
  // Use an inner join on inspections so only facilities with at least one inspection
  // are included. This prevents thin/noindex pages (publishable=true but 0 inspections)
  // from appearing in the sitemap and causing "noindex page in sitemap" Ahrefs errors.
  type FacilitySitemapRow = {
    id: string;
    city_slug: string;
    slug: string;
    updated_at: string | null;
    beds: number | null;
  };

  // Supabase/PostgREST caps responses at 1,000 rows by default. Several states
  // exceed that limit, so an unpaginated query silently drops valid live pages
  // from the sitemap while their routes continue to return 200.
  const facilities: FacilitySitemapRow[] = [];
  for (let from = 0; ; from += SITEMAP_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("facilities")
      .select("id, city_slug, slug, updated_at, beds, inspections!facility_id!inner(id)")
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .order("id")
      .range(from, from + SITEMAP_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to build ${stateCode} facility sitemap entries: ${error.message}`);
    }

    const page = (data ?? []) as FacilitySitemapRow[];
    facilities.push(...page);
    if (page.length < SITEMAP_QUERY_PAGE_SIZE) break;
  }

  const smallIds = facilities
    .filter((facility) => azSmallHomeWithoutCitations(stateCode, facility.beds, 0))
    .map((facility) => facility.id);
  const withCitations = await azSmallHomesThatHaveCitations(supabase, smallIds);
  const listed = facilities.filter((facility) =>
    facilityListedInSitemap({
      stateCode,
      beds: facility.beds,
      deficiencyCount: withCitations.has(facility.id) ? 1 : 0,
      inspectionCount: 1,
    }),
  );

  return listed
    .sort((a, b) =>
      a.city_slug.localeCompare(b.city_slug) || a.slug.localeCompare(b.slug),
    )
    .map((f) => ({
      loc: `${SITE_ORIGIN}/${stateSlug}/${f.city_slug}/${f.slug}`,
      priority: "0.8",
      changefreq: "monthly" as const,
      ...(f.updated_at ? { lastmod: f.updated_at.split("T")[0] } : {}),
    }));
}

export async function collectFacilityEntries(
  supabase: SupabaseClient,
): Promise<SitemapUrlRow[]> {
  const out: SitemapUrlRow[] = [];
  for (const s of COVERED_STATES) {
    out.push(...(await collectFacilityEntriesForState(supabase, s.code, s.slug)));
  }
  return out;
}
