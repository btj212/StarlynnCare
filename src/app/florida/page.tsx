import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicClient } from "@/lib/supabase/server";
import type { FacilityListRow } from "@/lib/types";

export const revalidate = 3600;

function groupByCity(facilities: FacilityListRow[]) {
  const map = new Map<string, FacilityListRow[]>();
  for (const f of facilities) {
    const city = f.city?.trim() || "Unknown city";
    if (!map.has(city)) map.set(city, []);
    map.get(city)!.push(f);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default async function FloridaPage() {
  const supabase = tryPublicClient();
  let facilities: FacilityListRow[] = [];
  let fetchError: string | null = null;

  if (!supabase) {
    fetchError =
      "Supabase environment variables are not set. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.local.example).";
  } else {
    const { data, error } = await supabase
      .from("facilities")
      .select(
        "id, name, city, city_slug, slug, cms_star_rating, beds, last_inspection_date",
      )
      .eq("state_code", "FL")
      .order("city", { ascending: true })
      .order("name", { ascending: true });

    if (error) fetchError = error.message;
    else facilities = (data ?? []) as FacilityListRow[];
  }

  const grouped = groupByCity(facilities);
  const count = facilities.length;
  const updated = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date());

  return (
    <>
      <SiteNav />
      <main className="min-h-[60vh] border-b border-sc-border bg-warm-white">
        <div className="mx-auto max-w-[1120px] px-6 py-14 md:px-8 md:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Florida
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
            Nursing &amp; memory care facilities
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
            Profiles are built from CMS and AHCA primary sources. List updates as
            ingestion runs—each facility page will show citations and effective
            dates.
          </p>
          <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-l-2 border-teal pl-5 text-sm text-slate">
            <span>
              <strong className="font-semibold text-ink">{count}</strong>{" "}
              facilities loaded
            </span>
            <span className="text-muted">Page generated {updated}</span>
          </div>

          {fetchError ? (
            <div
              className="mt-12 rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm text-ink"
              role="status"
            >
              <p className="font-semibold text-amber">Configuration</p>
              <p className="mt-2 leading-relaxed text-slate">{fetchError}</p>
            </div>
          ) : count === 0 ? (
            <div className="mt-14 rounded-lg border border-sc-border bg-white px-6 py-10 shadow-card">
              <p className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                No Florida facilities yet
              </p>
              <p className="mt-3 max-w-xl leading-relaxed text-slate">
                This index will populate automatically after CMS and state data are
                ingested (Sprint 2). The database and routes are ready—what you&apos;re
                seeing is an intentional empty state, not a broken page.
              </p>
              <p className="mt-6 font-mono text-xs text-muted">
                changelog: schema v2 deployed · awaiting CMS ingest
              </p>
            </div>
          ) : (
            <div className="mt-14 space-y-16">
              {grouped.map(([city, rows]) => (
                <section key={city}>
                  <h2 className="border-b border-sc-border pb-3 font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    {city}
                  </h2>
                  <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={`/facility/${f.slug}`}
                          className="group block rounded-lg border border-sc-border bg-white p-5 shadow-card transition hover:border-teal/40 hover:shadow-card-hover"
                        >
                          <span className="font-semibold text-ink group-hover:text-teal">
                            {f.name}
                          </span>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {f.beds != null && <span>{f.beds} beds</span>}
                            {f.cms_star_rating != null && (
                              <span>CMS {f.cms_star_rating}★</span>
                            )}
                            {f.last_inspection_date && (
                              <span>
                                Last inspection{" "}
                                {f.last_inspection_date}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
