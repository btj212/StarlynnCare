import Link from "next/link";
import { SectionHead } from "@/components/editorial/SectionHead";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { formatFacilityName } from "@/lib/facility/displayName";

export type RecentReport = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  /** Date of the home's newest visit that cited at least one finding (YYYY-MM-DD). */
  date: string;
  /** Findings cited at that one visit. */
  findings: number;
};

type Props = {
  reports: RecentReport[];
  stateSlug: string;
  regionName: string;
  /** Regulator short name, e.g. "CDSS". */
  agency: string;
};

/**
 * The homes in a city with the newest cited inspection visit. Each row links
 * to the home's full-report page and to its profile, so a city page hands
 * crawlers and readers the freshest records first.
 */
export function RecentInspectionReports({ reports, stateSlug, regionName, agency }: Props) {
  if (reports.length === 0) return null;

  return (
    <div id="recent-reports" className="border-t border-clearing-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-[60px]">
        <SectionHead
          label="§ Recent reports"
          title={
            <>
              Newest inspection findings in {regionName}, <em>in the inspector&rsquo;s words.</em>
            </>
          }
          deck="Each home below had at least one citation at its latest visit. Open the full report to read it."
        />
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
          {reports.map((r) => {
            const base = `/${stateSlug}/${r.city_slug}/${r.slug}`;
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-clearing-rule-2 bg-clearing-card px-5 py-4 shadow-[var(--shadow-card)]"
              >
                <Link
                  href={base}
                  className="block font-[family-name:var(--font-sans)] text-[17px] font-semibold leading-snug text-ink underline-offset-4 hover:underline"
                >
                  {formatFacilityName(r.name)}
                </Link>
                <p className="mb-2 mt-1 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-3">
                  {r.date} · {r.findings} {r.findings === 1 ? "finding" : "findings"} at this visit
                </p>
                <Link
                  href={`${base}/inspections`}
                  className="text-[14px] font-semibold text-teal underline underline-offset-4"
                >
                  Read the full report →
                </Link>
              </li>
            );
          })}
        </ul>
        <DataFootnote source={`${agency} inspection records, last three years`} />
      </div>
    </div>
  );
}
