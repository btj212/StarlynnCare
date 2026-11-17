import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { formatFacilityName } from "@/lib/facility/displayName";

interface RelatedFacilitiesProps {
  /** The current facility's ID — excluded from results */
  facilityId: string;
  citySlug: string;
  stateSlug: string;
  /** Optional county name hint for fallback broadening */
  countySlug?: string;
}

type RelatedRow = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  city_slug: string;
};

const RELATED_LIMIT = 12;

async function loadRelated(
  facilityId: string,
  citySlug: string,
): Promise<RelatedRow[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("related_facilities", {
    p_facility_id: facilityId,
    p_city_slugs: [citySlug],
    p_limit: RELATED_LIMIT,
  });
  if (error) {
    console.error("[related] related_facilities failed:", error.message);
    return [];
  }
  return (data ?? []) as RelatedRow[];
}

/**
 * Server component. Renders a "Related in [city]" rail of the 12 nearest homes in
 * the same city that are in the sitemap. Nearest-first spreads inbound links across
 * the whole city instead of the same 8 homes.
 */
export async function RelatedFacilities({
  facilityId,
  citySlug,
  stateSlug,
}: RelatedFacilitiesProps) {
  const related = await loadRelated(facilityId, citySlug);
  if (related.length === 0) return null;

  return (
    <section className="border-t border-paper-rule pt-12 mt-12">
      <div className="mb-3 font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal inline-block">
        Related in this city
      </div>
      <h2
        className="font-[family-name:var(--font-sans)] font-semibold text-[28px] leading-[1.1] tracking-[-0.01em] text-ink mb-8"
      >
        Other memory care options <em>nearby.</em>
      </h2>

      <div className="grid gap-3 md:grid-cols-3">
        {related.map((f) => (
          <Link
            key={f.id}
            href={`/${stateSlug}/${f.city_slug}/${f.slug}`}
            className="card-lift flex items-start gap-4 rounded-2xl border border-clearing-rule-2 bg-clearing-card px-5 py-5 text-ink no-underline shadow-[var(--shadow-card)] transition-colors hover:border-teal/25"
          >
            <div>
              <p className="font-[family-name:var(--font-sans)] font-semibold text-[18px] leading-[1.15] tracking-[-0.005em] m-0">
                {formatFacilityName(f.name)}
              </p>
              {f.city && (
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em] mt-1">
                  {f.city}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
