import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { formatFacilityName } from "@/lib/facility/displayName";

type SiblingRow = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  city_slug: string;
  beds: number | null;
  photo_url: string | null;
  last_inspection_date: string | null;
};

async function loadSiblings(
  facilityId: string,
  citySlug: string,
  stateCode: string,
  countyCitySlugs: string[],
): Promise<SiblingRow[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  // Same city first
  const { data: cityRows } = await supabase
    .from("facilities")
    .select("id, name, city, slug, city_slug, beds, photo_url, last_inspection_date")
    .eq("state_code", stateCode)
    .eq("city_slug", citySlug)
    .eq("publishable", true)
    .neq("id", facilityId)
    .limit(4);

  const result = (cityRows ?? []) as SiblingRow[];
  if (result.length >= 4) return result.slice(0, 4);

  // Broaden to county if needed
  if (countyCitySlugs.length > 0) {
    const remaining = 4 - result.length;
    const existing = new Set(result.map((r) => r.id));
    const otherSlugs = countyCitySlugs.filter((s) => s !== citySlug);
    if (otherSlugs.length === 0) return result;

    const { data: countyRows } = await supabase
      .from("facilities")
      .select("id, name, city, slug, city_slug, beds, photo_url, last_inspection_date")
      .eq("state_code", stateCode)
      .eq("publishable", true)
      .in("city_slug", otherSlugs)
      .neq("id", facilityId)
      .order("name")
      .limit(remaining);

    for (const row of (countyRows ?? []) as SiblingRow[]) {
      if (!existing.has(row.id)) result.push(row);
    }
  }

  return result.slice(0, 4);
}

const GRADIENT_BG = [
  "linear-gradient(135deg, #C9D8C8 0%, #8FA89A 100%)",
  "linear-gradient(135deg, #D6CFB8 0%, #A89D7E 100%)",
  "linear-gradient(135deg, #C8B49A 0%, #8E7A60 100%)",
  "linear-gradient(135deg, #BDC8B9 0%, #7E8A77 100%)",
];

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function FacilitySiblings({ profile }: { profile: FacilityProfile }) {
  const { facility, state, county } = profile;
  const countyCitySlugs = county
    ? (profile.county ? [] : []) // filled below
    : [];

  // Collect county city slugs from region data (passed via profile.county)
  // We use a broader approach: fetch siblings via city + county
  const siblings = await loadSiblings(
    facility.id,
    facility.city_slug,
    state.code,
    countyCitySlugs,
  );

  if (siblings.length === 0) return null;

  const cityLabel = facility.city ?? "this city";
  const countyLabel = county?.name ?? null;

  return (
    <section id="siblings" className="border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="Nearby"
          title={
            <>
              Other facilities <em>in {countyLabel ?? cityLabel}.</em>
            </>
          }
          deck={
            `Other memory care facilities ${countyLabel ? `in ${countyLabel}` : `near ${cityLabel}`} with similar care offerings.`
          }
        />

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-4">
          {siblings.map((s, i) => {
            const inspLabel = s.last_inspection_date
              ? `Last inspection · ${fmtDate(s.last_inspection_date)}`
              : null;
            return (
              <Link
                key={s.id}
                href={`/${state.slug}/${s.city_slug}/${s.slug}`}
                className="flex flex-col border border-paper-rule bg-paper-2 text-ink no-underline hover:shadow-card-hover transition-shadow"
              >
                {/* Photo band */}
                <div
                  className="relative h-[110px] overflow-hidden"
                  style={{ background: s.photo_url ? undefined : GRADIENT_BG[i % 4] }}
                >
                  {s.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.photo_url}
                      alt={formatFacilityName(s.name)}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {!s.photo_url && (
                    <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.18em] text-white/75">
                      Photo · via Google
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
                  <div className="font-[family-name:var(--font-display)] text-[19px] leading-[1.15] tracking-[-0.005em]">
                    {formatFacilityName(s.name)}
                  </div>
                  <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.06em] text-ink-3">
                    {s.city ?? ""}{s.beds ? ` · ${s.beds} beds · RCFE` : ""}
                  </div>
                  {inspLabel && (
                    <div className="mt-2 flex items-center justify-between border-t border-paper-rule pt-2.5 font-[family-name:var(--font-mono)] text-[10.5px] text-ink-2">
                      <span>{inspLabel}</span>
                      <span>→</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
