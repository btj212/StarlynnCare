import Link from "next/link";
import { facilityProfilePath } from "@/lib/seo/paths";

export type RegionHubStats = {
  median_beds: number | null;
  last_inspection_date: string | null;
  most_cited_category: string | null;
  most_cited_count: number | null;
  trend_recent: number | null;
  trend_mid: number | null;
  trend_prior: number | null;
  city_cit_per_fac: number | null;
  state_cit_per_fac: number | null;
  top_improved_name: string | null;
  top_improved_slug: string | null;
  top_improved_city_slug: string | null;
  top_improved_delta: number | null;
  top_deteriorated_name: string | null;
  top_deteriorated_slug: string | null;
  top_deteriorated_city_slug: string | null;
  top_deteriorated_delta: number | null;
};

type Props = {
  stats: RegionHubStats;
  regionName: string;
  stateSlug: string;
  stateName: string;
};

// Trend direction: compare the most-recent 12m window to the oldest 12m window.
// Returns "improving", "stable", or "worsening" with a threshold of ±15%.
function trendDirection(
  recent: number,
  prior: number,
): "improving" | "stable" | "worsening" {
  if (prior === 0) return recent === 0 ? "stable" : "worsening";
  const pct = (recent - prior) / prior;
  if (pct < -0.15) return "improving";
  if (pct > 0.15) return "worsening";
  return "stable";
}

function formatInspectionDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-3 border-b border-paper-rule last:border-0">
      <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4 sm:w-[220px] shrink-0">
        {label}
      </dt>
      <dd className="font-[family-name:var(--font-mono)] text-[13px] text-ink-2 m-0">
        {children}
      </dd>
    </div>
  );
}

export function HubDifferentiators({
  stats,
  regionName,
  stateSlug,
  stateName,
}: Props) {
  const {
    median_beds,
    last_inspection_date,
    most_cited_category,
    most_cited_count,
    trend_recent,
    trend_mid,
    trend_prior,
    city_cit_per_fac,
    state_cit_per_fac,
    top_improved_name,
    top_improved_slug,
    top_improved_city_slug,
    top_improved_delta,
    top_deteriorated_name,
    top_deteriorated_slug,
    top_deteriorated_city_slug,
    top_deteriorated_delta,
  } = stats;

  // Require at least two data points before rendering the section at all.
  const dataPoints = [
    median_beds,
    last_inspection_date,
    most_cited_category,
    trend_recent,
    city_cit_per_fac,
  ].filter((v) => v != null).length;

  if (dataPoints < 2) return null;

  const hasTrend =
    trend_recent != null && trend_mid != null && trend_prior != null;
  const direction = hasTrend
    ? trendDirection(trend_recent!, trend_prior!)
    : null;

  const directionColor =
    direction === "improving"
      ? "text-teal"
      : direction === "worsening"
      ? "text-rust"
      : "text-ink-3";

  const directionLabel =
    direction === "improving"
      ? "↓ Improving"
      : direction === "worsening"
      ? "↑ Worsening"
      : "→ Stable";

  return (
    <div
      className="border-b border-paper-rule"
      style={{ background: "var(--color-paper-2)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-10">
        <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
          § What the numbers show
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[22px] sm:text-[26px] font-normal leading-[1.1] tracking-[-0.01em] text-ink mb-1">
          {regionName} — <em>by the data</em>
        </h2>
        <p className="text-[14px] text-ink-4 mb-6 font-[family-name:var(--font-mono)]">
          Derived from indexed inspections and deficiency records. Only shown
          when sufficient data exists.
        </p>

        <dl className="max-w-[720px]">
          {most_cited_category && most_cited_count != null && (
            <Row label="Most-cited issue · last 3 yrs">
              <span className="text-ink">{most_cited_category}</span>
              <span className="text-ink-4 ml-2">({most_cited_count} citations indexed)</span>
            </Row>
          )}

          {hasTrend && direction != null && (
            <Row label="Citation trend · 3-year window">
              <span className={directionColor}>{directionLabel}</span>
              <span className="text-ink-4 ml-2">
                {trend_prior} → {trend_mid} → {trend_recent} (citations per 12-month window)
              </span>
            </Row>
          )}

          {city_cit_per_fac != null && state_cit_per_fac != null && (
            <Row label={`${regionName} vs. ${stateName} avg`}>
              <span className={city_cit_per_fac <= state_cit_per_fac ? "text-teal" : "text-rust"}>
                {city_cit_per_fac}
              </span>
              <span className="text-ink-4 ml-1">citations/facility here vs.</span>
              <span className="text-ink ml-1">{state_cit_per_fac}</span>
              <span className="text-ink-4 ml-1">statewide (36 months)</span>
            </Row>
          )}

          {median_beds != null && (
            <Row label="Median beds per home">
              <span className="text-ink">{Math.round(Number(median_beds))}</span>
              <span className="text-ink-4 ml-1">beds</span>
            </Row>
          )}

          {top_improved_name && top_improved_slug && top_improved_city_slug && top_improved_delta != null && (
            <Row label="Most improved · yr-over-yr">
              <Link
                href={facilityProfilePath(stateSlug, top_improved_city_slug, top_improved_slug)}
                className="text-teal underline underline-offset-2 hover:opacity-80"
              >
                {top_improved_name}
              </Link>
              <span className="text-teal ml-2">
                {top_improved_delta} citations vs. prior year
              </span>
            </Row>
          )}

          {top_deteriorated_name && top_deteriorated_slug && top_deteriorated_city_slug && top_deteriorated_delta != null && (
            <Row label="Most citations added · yr-over-yr">
              <Link
                href={facilityProfilePath(stateSlug, top_deteriorated_city_slug, top_deteriorated_slug)}
                className="text-rust underline underline-offset-2 hover:opacity-80"
              >
                {top_deteriorated_name}
              </Link>
              <span className="text-rust ml-2">
                +{top_deteriorated_delta} citations vs. prior year
              </span>
            </Row>
          )}

          {last_inspection_date && (
            <Row label="Last inspected (region)">
              <span className="text-ink">
                {formatInspectionDate(last_inspection_date)}
              </span>
            </Row>
          )}
        </dl>

        <p className="mt-5 font-[family-name:var(--font-mono)] text-[11px] text-ink-4">
          Sources: indexed state inspection records.{" "}
          <Link href="/methodology" className="text-teal hover:underline">
            See methodology
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
