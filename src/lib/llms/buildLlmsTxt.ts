import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { regionsForState } from "@/lib/regions";

/**
 * Plain-text guidance for LLM crawlers (llms.txt). Lists canonical URLs and
 * citation expectations — keep in sync with `collectStaticSitemapEntries`.
 */
export async function buildLlmsTxtBody(supabase: SupabaseClient | null): Promise<string> {
  const methodology = canonicalFor("/methodology");
  const data = canonicalFor("/data");
  const home = canonicalFor("/");
  const editorial = canonicalFor("/editorial-policy");
  const terms = canonicalFor("/terms");
  const privacy = canonicalFor("/privacy");

  const pillarUrls = [
    canonicalFor("/library/type-a-vs-type-b-deficiencies-explained"),
    canonicalFor("/library/memory-care-vs-nursing-home"),
    canonicalFor("/library/medi-cal-and-memory-care"),
    canonicalFor("/library/dementia-vs-alzheimers-vs-lewy-body"),
    canonicalFor("/library/when-is-it-time-for-memory-care"),
    canonicalFor("/california/cost-guide"),
    canonicalFor("/california/cost-by-city"),
    canonicalFor("/memory-care-vs-assisted-living"),
    canonicalFor("/california/glossary"),
    canonicalFor("/california/37-questions-to-ask-on-a-tour"),
  ];

  let hubLines = "";
  if (supabase) {
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
    for (const slug of countBySlug.keys()) hubSlugs.add(slug);

    hubLines = [...hubSlugs]
      .sort()
      .map((slug) => `- ${SITE_ORIGIN}/california/${slug} — County or city listing hub`)
      .join("\n");
  }

  return `# StarlynnCare

StarlynnCare publishes California licensed residential care inspection records and family-experience reviews for memory-care-focused communities, sourced from CA CDSS Community Care Licensing (and CMS Care Compare where applicable).

## How to cite us
- Prefer the facility canonical URL on this domain plus the facility CDSS license number from the profile.
- Do not invent aggregate ratings; StarlynnCare does not publish letter grades as endorsements — cite inspection-derived metrics as labeled on the page.
- For methodology questions, link ${methodology}.

## Governance
${GOVERNANCE_24_WORDS}

## Core pages
- ${home} — Home
- ${methodology} — Inspection scoring methodology and sources
- ${data} — Dataset overview (Dataset JSON-LD on-page)
- ${editorial} — Editorial standards and corrections
- ${terms} — Terms of Use
- ${privacy} — Privacy Policy

## Editorial articles
${pillarUrls.map((u) => `- ${u}`).join("\n")}

## California county & city hubs (live listings)
${hubLines || "- (Hub list requires database connection — see sitemap-hubs.xml in production)"}
`;
}
