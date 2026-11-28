import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { formatFacilityName } from "@/lib/facility/displayName";
import { weightedCitationsPerBedPhrase } from "@/lib/facility/pageCopy";
import { REGULATOR_ABBR } from "@/lib/seo/meta";

interface TopGradedFacilitiesProps {
  citySlugs: ReadonlyArray<string>;
  stateCode: string;
  stateSlug: string;
  countyName: string;
  /** When true, the heading names the city instead of a county. */
  isCity?: boolean;
}

type FacilityRow = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  city_slug: string;
};

type Compared = FacilityRow & {
  value: number;
  peerMedian: number;
};

const WINDOW_MONTHS = 36;
const SHOW = 8;

async function loadFewestWeighted(
  citySlugs: ReadonlyArray<string>,
  stateCode: string,
): Promise<Compared[]> {
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
      supabase.rpc("facility_snapshot", { p_facility_id: f.id }).then(({ data }) => {
        const snap = data as {
          peer_set?: { n?: number };
          metrics?: { severity?: { value?: number | null; peer_median?: number | null } };
        } | null;
        const ready = (snap?.peer_set?.n ?? 0) >= 10;
        const value = snap?.metrics?.severity?.value;
        const peerMedian = snap?.metrics?.severity?.peer_median;
        return {
          id: f.id,
          value: ready && typeof value === "number" && Number.isFinite(value) ? value : null,
          peerMedian:
            ready && typeof peerMedian === "number" && Number.isFinite(peerMedian) ? peerMedian : null,
        };
      }),
    ),
  );
  const snapMap = new Map(snapshots.map((s) => [s.id, s]));

  return typed
    .map((f) => {
      const snap = snapMap.get(f.id);
      if (snap?.value == null || snap.peerMedian == null) return null;
      return { ...f, value: snap.value, peerMedian: snap.peerMedian };
    })
    .filter((f): f is Compared => f != null)
    .sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));
}

/**
 * Competition position: equal values share a position, and the next
 * distinct value skips ahead. Alphabetical order inside a tie is only
 * so the list is stable.
 */
function competitionPositions(values: number[]): number[] {
  const positions: number[] = [];
  values.forEach((value, index) => {
    if (index > 0 && value === values[index - 1]) positions.push(positions[index - 1]);
    else positions.push(index + 1);
  });
  return positions;
}

/**
 * Homes with the lowest weighted citations per bed. A home with no
 * measured value or no peer median is left out. Ties share one position.
 */
export async function TopGradedFacilities({
  citySlugs,
  stateCode,
  stateSlug,
  countyName,
}: TopGradedFacilitiesProps) {
  const compared = await loadFewestWeighted(citySlugs, stateCode);
  if (compared.length === 0) return null;

  const shown: Compared[] = [];
  for (const row of compared) {
    if (shown.length >= SHOW && row.value !== shown[shown.length - 1].value) break;
    shown.push(row);
  }
  const positions = competitionPositions(shown.map((row) => row.value));
  const agency = REGULATOR_ABBR[stateCode] ?? "state";
  const heading = `Fewest weighted citations per bed (${agency}, ${WINDOW_MONTHS} months)`;

  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
        <div className="mb-3 font-[family-name:var(--font-sans)] text-[13px] font-semibold uppercase tracking-[0.14em] text-teal inline-block">
          § {heading}
        </div>
        <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4vw,44px)] leading-[1.06] tracking-[-0.015em] text-ink mb-8">
          Homes in {countyName} <em>with a published figure.</em>
        </h2>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {shown.map((f, index) => {
            const phrase = weightedCitationsPerBedPhrase({
              value: f.value,
              peerMedian: f.peerMedian,
              agencyShort: agency,
              windowMonths: WINDOW_MONTHS,
            });
            const tied = shown.filter((row) => row.value === f.value).length > 1;
            return (
              <Link
                key={f.id}
                href={`/${stateSlug}/${f.city_slug}/${f.slug}`}
                className="card-lift flex items-start justify-between gap-3 rounded-2xl border border-clearing-rule-2 bg-clearing-card px-5 py-5 text-ink no-underline shadow-[var(--shadow-card)] transition-colors hover:border-teal/25"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-[family-name:var(--font-sans)] font-semibold text-[15px] leading-[1.2] tracking-[-0.005em] m-0 text-ink line-clamp-2">
                    {formatFacilityName(f.name)}
                  </p>
                  {f.city && (
                    <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em] mt-1">
                      {f.city}
                    </p>
                  )}
                  {phrase ? (
                    <p className="mt-2 font-[family-name:var(--font-sans)] text-[12px] leading-snug text-ink-3">
                      {phrase}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] font-semibold px-2 py-1 rounded bg-teal/10 text-teal-deep tabular-nums">
                  {tied ? `Tied ${positions[index]}` : positions[index]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
