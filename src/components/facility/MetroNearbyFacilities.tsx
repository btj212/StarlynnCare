import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { countyRegionContainingCitySlug } from "@/lib/regionsCountyLookup";
import { stateFromSlug } from "@/lib/states";
import { formatFacilityName } from "@/lib/facility/displayName";

type Props = {
  facilityId: string;
  citySlug: string;
  stateSlug: string;
};

type Row = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  city_slug: string;
};

const MAX_NEARBY = 8;

/**
 * Publishable facilities in other cities within the same county region (cross-metro discovery).
 */
export async function MetroNearbyFacilities({ facilityId, citySlug, stateSlug }: Props) {
  const stateInfo = stateFromSlug(stateSlug);
  if (!stateInfo) return null;

  const county = countyRegionContainingCitySlug(stateInfo.code, citySlug);
  const siblingSlugs =
    county?.citySlugs.filter((s) => s.toLowerCase() !== citySlug.toLowerCase()) ?? [];
  if (siblingSlugs.length === 0) return null;

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;

  const { data: raw } = await supabase
    .from("facilities")
    .select("id, name, city, slug, city_slug")
    .eq("state_code", stateInfo.code)
    .eq("publishable", true)
    .in("city_slug", siblingSlugs)
    .neq("id", facilityId)
    .order("last_inspection_date", { ascending: false, nullsFirst: false })
    .limit(MAX_NEARBY);

  if (!raw?.length) return null;

  const ranked = raw as Row[];

  return (
    <section className="border-t border-paper-rule pt-12 mt-12">
      <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
        Nearby cities · same county
      </div>
      <h2 className="font-[family-name:var(--font-sans)] font-semibold text-[28px] leading-[1.1] tracking-[-0.01em] text-ink mb-3">
        More options <em>in neighboring cities</em>
      </h2>
      <p className="text-[14px] text-ink-3 max-w-[72ch] leading-relaxed mb-8">
        Licensed memory care in other cities within this county region — useful when your search radius crosses city limits.
      </p>

      <div className="grid gap-0 border-t border-ink md:grid-cols-2 lg:grid-cols-4">
        {ranked.map((f) => (
          <Link
            key={f.id}
            href={`/${stateSlug}/${f.city_slug}/${f.slug}`}
            className="flex flex-col gap-1 px-5 py-4 border-r border-b border-paper-rule last:border-r-0 no-underline text-ink hover:bg-paper-2 transition-colors min-h-[5rem]"
          >
            <span className="font-[family-name:var(--font-sans)] font-semibold text-[17px] leading-[1.15] tracking-[-0.005em]">
              {formatFacilityName(f.name)}
            </span>
            {f.city && (
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em]">
                {f.city}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
