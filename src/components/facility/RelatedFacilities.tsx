import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

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
  grade: string | null;
  composite: number | null;
};

async function loadRelated(
  facilityId: string,
  citySlug: string,
  stateSlug: string,
): Promise<RelatedRow[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const stateCode = stateSlug === "california" ? "CA" : stateSlug.toUpperCase().slice(0, 2);

  // Same city, up to 8 siblings (we'll narrow to top 6 after grade lookup)
  const { data: raw } = await supabase
    .from("facilities")
    .select("id, name, city, slug, city_slug")
    .eq("state_code", stateCode)
    .eq("city_slug", citySlug)
    .eq("publishable", true)
    .neq("id", facilityId)
    .order("name")
    .limit(10);

  if (!raw || raw.length === 0) return [];

  const typed = raw as Array<{ id: string; name: string; city: string | null; slug: string; city_slug: string }>;

  // Fetch grades in parallel
  const snapshots = await Promise.all(
    typed.map((f) =>
      supabase
        .rpc("facility_snapshot", { p_facility_id: f.id })
        .then(({ data }) => ({
          id: f.id,
          grade: (data as { grade?: { letter: string; composite_percentile: number } | null } | null)?.grade ?? null,
        })),
    ),
  );

  const snapMap = new Map(snapshots.map((s) => [s.id, s.grade]));

  return typed
    .map((f) => {
      const snap = snapMap.get(f.id);
      return {
        ...f,
        grade: snap?.letter ?? null,
        composite: snap?.composite_percentile ?? null,
      };
    })
    .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))
    .slice(0, 6);
}

/**
 * Server component. Renders a "Related in [city]" rail showing up to 6 sibling
 * facilities sorted by grade (highest first). Used on facility pages (audit #15).
 */
export async function RelatedFacilities({
  facilityId,
  citySlug,
  stateSlug,
}: RelatedFacilitiesProps) {
  const related = await loadRelated(facilityId, citySlug, stateSlug);
  if (related.length === 0) return null;

  const gradeColor = (letter: string | null) => {
    if (!letter) return { text: "var(--color-ink-4)", bg: "var(--color-paper-2)" };
    if (letter.startsWith("A")) return { text: "var(--color-grade-a)", bg: "#DCE9D6" };
    if (letter.startsWith("B")) return { text: "var(--color-grade-b)", bg: "#E5EBD3" };
    if (letter.startsWith("C")) return { text: "var(--color-grade-c)", bg: "var(--color-gold-soft)" };
    if (letter.startsWith("D")) return { text: "var(--color-grade-d)", bg: "var(--color-rust-soft)" };
    return { text: "var(--color-grade-f)", bg: "#E8C9C2" };
  };

  return (
    <section className="border-t border-paper-rule pt-12 mt-12">
      <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
        Related in this city
      </div>
      <h2
        className="font-[family-name:var(--font-sans)] font-semibold text-[28px] leading-[1.1] tracking-[-0.01em] text-ink mb-8"
      >
        Other memory care options <em>nearby.</em>
      </h2>

      <div className="grid gap-0 border-t border-ink md:grid-cols-3">
        {related.map((f) => {
          const { text: gradeText, bg: gradeBg } = gradeColor(f.grade);
          return (
            <Link
              key={f.id}
              href={`/${stateSlug}/${f.city_slug}/${f.slug}`}
              className="flex items-start gap-4 px-5 py-5 border-r border-b border-paper-rule last:border-r-0 no-underline text-ink hover:bg-paper-2 transition-colors"
            >
              {/* Grade badge */}
              <div
                className="w-12 h-12 flex items-center justify-center font-[family-name:var(--font-sans)] font-bold text-[24px] leading-none shrink-0 border"
                style={{ background: gradeBg, color: gradeText, borderColor: gradeText }}
              >
                {f.grade ?? "?"}
              </div>
              <div>
                <p className="font-[family-name:var(--font-sans)] font-semibold text-[18px] leading-[1.15] tracking-[-0.005em] m-0">
                  {f.name}
                </p>
                {f.city && (
                  <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em] mt-1">
                    {f.city}
                    {f.composite != null && ` · ${Math.round(f.composite)}th pct`}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
