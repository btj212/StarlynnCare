import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

interface TopGradedFacilitiesProps {
  citySlugs: ReadonlyArray<string>;
  stateCode: string;
  stateSlug: string;
  countyName: string;
}

type FacilityRow = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  city_slug: string;
};

type Ranked = FacilityRow & {
  composite: number | null;
};

async function loadTopGraded(
  citySlugs: ReadonlyArray<string>,
  stateCode: string,
): Promise<Ranked[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data: raw } = await supabase
    .from("facilities")
    .select("id, name, city, slug, city_slug")
    .eq("state_code", stateCode)
    .eq("publishable", true)
    .in("city_slug", citySlugs as unknown as string[])
    .order("name")
    .limit(40);

  if (!raw || raw.length === 0) return [];

  const typed = raw as FacilityRow[];

  const snapshots = await Promise.all(
    typed.map((f) =>
      supabase
        .rpc("facility_snapshot", { p_facility_id: f.id })
        .then(({ data }) => ({
          id: f.id,
          grade: (data as { grade?: { letter: string; composite_percentile: number } | null } | null)
            ?.grade ?? null,
        })),
    ),
  );

  const snapMap = new Map(snapshots.map((s) => [s.id, s.grade]));

  return typed
    .map((f) => {
      const snap = snapMap.get(f.id);
      return {
        ...f,
        composite: snap?.composite_percentile ?? null,
      };
    })
    .filter((f) => f.composite !== null)
    .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))
    .slice(0, 8);
}

/**
 * Server component. Renders a "Top performers in [county]" rail of up to 8
 * facilities sorted by composite_percentile (highest first). Used on county
 * hub pages to give Googlebot anchor tags into facility profiles.
 */
export async function TopGradedFacilities({
  citySlugs,
  stateCode,
  stateSlug,
  countyName,
}: TopGradedFacilitiesProps) {
  const facilities = await loadTopGraded(citySlugs, stateCode);
  if (facilities.length === 0) return null;

  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
        <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
          § Top performers in {countyName}
        </div>
        <h2
          className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4vw,44px)] leading-[1.06] tracking-[-0.015em] text-ink mb-8"
        >
          Highest-performing facilities <em>by state inspection record.</em>
        </h2>

        <div className="grid gap-0 border-t border-ink md:grid-cols-2 lg:grid-cols-4">
          {facilities.map((f) => (
            <Link
              key={f.id}
              href={`/${stateSlug}/${f.city_slug}/${f.slug}`}
              className="flex items-start justify-between gap-3 px-5 py-5 border-r border-b border-paper-rule last:border-r-0 no-underline text-ink hover:bg-paper-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-[family-name:var(--font-sans)] font-semibold text-[15px] leading-[1.2] tracking-[-0.005em] m-0 text-ink line-clamp-2">
                  {f.name}
                </p>
                {f.city && (
                  <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em] mt-1">
                    {f.city}
                  </p>
                )}
              </div>
              {f.composite !== null && (
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] font-semibold px-2 py-1 rounded bg-teal/10 text-teal-deep tabular-nums">
                  Top {100 - f.composite}%
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
