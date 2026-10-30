import Link from "next/link";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { StatBlock } from "@/components/editorial/StatBlock";
import {
  formatRecordDate,
  type StateMemoryCareStats,
} from "@/lib/data/stateMemoryCareStats";

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function StateMemoryCareStatsSection({
  stats,
}: {
  stats: StateMemoryCareStats | null;
}) {
  if (!stats) {
    return (
      <section className="mx-auto mt-4 max-w-[1100px] px-6 pb-4 md:px-8">
        <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
          The record, by state.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate">
          The state counts could not be loaded.
        </p>
      </section>
    );
  }

  const published = stats.rows.reduce((sum, row) => sum + row.published, 0);
  const withInspection = stats.rows.reduce((sum, row) => sum + row.withInspection, 0);
  const seriousHomes = stats.rows.reduce((sum, row) => sum + row.seriousHomes, 0);
  const newest = stats.rows.reduce<string | null>((latest, row) => {
    if (!row.newestInspection) return latest;
    if (!latest || row.newestInspection > latest) return row.newestInspection;
    return latest;
  }, null);
  const cutoffLabel = formatRecordDate(stats.cutoff) ?? stats.cutoff;

  return (
    <section className="mx-auto mt-2 max-w-[1100px] px-6 pb-6 md:px-8">
      <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
        The record, by state.
      </h2>
      <p className="mt-4 max-w-[760px] text-base leading-relaxed text-slate">
        Published homes, homes with an inspection on file, homes with a serious
        citation in the last 24 months, and the newest inspection date we hold.
      </p>
      <div className="mt-8">
        <StatBlock
          compact
          stats={[
            { n: formatCount(published), label: "Published homes", src: "State rows" },
            {
              n: formatCount(withInspection),
              label: "Homes with an inspection on file",
              src: "Inspection rows",
            },
            {
              n: formatCount(seriousHomes),
              label: "Homes with a serious citation in 24 months",
              src: "Type A or severity 3+",
            },
            {
              n: formatRecordDate(newest) ?? "None on record",
              label: "Newest inspection date we hold",
              src: "Inspection dates",
            },
          ]}
        />
      </div>
      <ul className="mt-8 divide-y divide-sc-border md:hidden">
        {stats.rows.map((row) => (
          <li key={row.code} className="py-5">
            <Link
              href={`/${row.slug}`}
              className="font-medium text-navy underline-offset-2 hover:underline"
            >
              {row.name}
            </Link>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  Published
                </dt>
                <dd className="mt-1 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatCount(row.published)}
                </dd>
              </div>
              <div>
                <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  With an inspection
                </dt>
                <dd className="mt-1 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatCount(row.withInspection)}
                </dd>
              </div>
              <div>
                <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  Serious, 24 months
                </dt>
                <dd className="mt-1 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatCount(row.seriousHomes)}
                </dd>
              </div>
              <div>
                <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  Newest inspection
                </dt>
                <dd className="mt-1 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatRecordDate(row.newestInspection) ?? "None on record"}
                </dd>
              </div>
            </dl>
            <DataFootnote source={row.regulatorLong} />
          </li>
        ))}
      </ul>
      <div className="mt-8 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
              <th className="pb-3 pr-4 font-medium">State</th>
              <th className="pb-3 pr-4 font-medium">Published</th>
              <th className="pb-3 pr-4 font-medium">With an inspection</th>
              <th className="pb-3 pr-4 font-medium">Serious citation, 24 months</th>
              <th className="pb-3 font-medium">Newest inspection</th>
            </tr>
          </thead>
          <tbody>
            {stats.rows.map((row) => (
              <tr key={row.code} className="border-t border-sc-border align-top">
                <td className="py-4 pr-4">
                  <Link
                    href={`/${row.slug}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <DataFootnote source={row.regulatorLong} />
                </td>
                <td className="py-4 pr-4 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatCount(row.published)}
                </td>
                <td className="py-4 pr-4 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatCount(row.withInspection)}
                </td>
                <td className="py-4 pr-4 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatCount(row.seriousHomes)}
                </td>
                <td className="py-4 font-[family-name:var(--font-mono)] text-sm text-ink">
                  {formatRecordDate(row.newestInspection) ?? "None on record"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataFootnote
        source="Inspection and deficiency rows on publishable homes"
        note={`Serious means a Type A finding, or a finding stored at severity 3 or higher, on an inspection dated on or after ${cutoffLabel}. The serious column counts homes, not findings.`}
      />
    </section>
  );
}
