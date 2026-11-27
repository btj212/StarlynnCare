import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { facilityDisplayName } from "@/lib/facility/aliases";
import { pickNearbyFacilities, type NearbyHome } from "@/lib/facility/nearbyFacilities";
import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";

const SELECT =
  "id, name, city, slug, city_slug, latitude, longitude, marketing_name, content, publishable";

async function loadCandidates(
  facilityId: string,
  citySlug: string,
  stateCode: string,
): Promise<NearbyHome[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data: cityRows, error } = await supabase
    .from("facilities")
    .select(SELECT)
    .eq("state_code", stateCode)
    .eq("city_slug", citySlug)
    .eq("publishable", true)
    .neq("id", facilityId);
  if (error) {
    console.error("[nearby] city query failed:", error.message);
    return [];
  }
  const city = (cityRows ?? []) as NearbyHome[];
  if (city.length >= 3) return city;

  const { data: stateRows, error: stateError } = await supabase
    .from("facilities")
    .select(SELECT)
    .eq("state_code", stateCode)
    .eq("publishable", true)
    .neq("city_slug", citySlug)
    .neq("id", facilityId);
  if (stateError) {
    console.error("[nearby] state query failed:", stateError.message);
    return city;
  }
  return [...city, ...((stateRows ?? []) as NearbyHome[])];
}

export async function NearbyFacilities({ profile }: { profile: FacilityProfile }) {
  const { facility, state } = profile;
  const homes = await loadCandidates(facility.id, facility.city_slug, state.code);
  const nearby = pickNearbyFacilities({
    selfId: facility.id,
    citySlug: facility.city_slug,
    latitude: facility.latitude,
    longitude: facility.longitude,
    homes,
  });
  if (nearby.length === 0) return null;

  return (
    <section className="border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(28px,4vw,44px)] font-normal leading-[1.08] tracking-[-0.01em] text-ink">
          Nearby facilities
        </h2>
        <ul className="m-0 mt-8 grid list-none gap-3 p-0 md:grid-cols-3">
          {nearby.map((home) => (
            <li key={home.id}>
              <Link
                href={`/${state.slug}/${home.city_slug}/${home.slug}`}
                className="block rounded-2xl border border-clearing-rule-2 bg-clearing-card px-5 py-5 font-[family-name:var(--font-sans)] text-[18px] font-semibold leading-[1.15] text-ink no-underline shadow-[var(--shadow-card)] hover:border-teal/25"
              >
                {facilityDisplayName(home)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
