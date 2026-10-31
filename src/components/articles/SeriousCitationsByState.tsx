import Link from "next/link";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import {
  formatRecordDate,
  loadStateMemoryCareStats,
  type StateMemoryCareStats,
} from "@/lib/data/stateMemoryCareStats";
import {
  SERIOUS_COUNT_SENTENCE,
  SERIOUS_PROFILE_TAGS,
} from "@/lib/content/seriousCitationTerms";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

const ILLUSTRATION = {
  src: "/illustrations/serious-citations-by-state.png",
  alt: "Illustrated wooden table by a window, with a closed folder, a cup, and a small plant — standing in for a family reading a state's inspection record",
};

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function inspectionSentence(published: number, withInspection: number, newest: string | null): string {
  const date = formatRecordDate(newest);
  const coverage =
    withInspection === published
      ? `All ${formatCount(published)} published homes have an inspection on file.`
      : `${formatCount(withInspection)} of ${formatCount(published)} published homes have an inspection on file.`;
  return date ? `${coverage} The newest inspection date we hold is ${date}.` : coverage;
}

function ReportTable({ stats }: { stats: StateMemoryCareStats }) {
  return (
    <>
      <ul className="mt-8 divide-y divide-sc-border md:hidden">
        {stats.rows.map((row) => (
          <li key={row.code} className="py-5">
            <p className="font-medium text-navy">{row.name}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {formatCount(row.seriousHomes)} homes with a serious citation.{" "}
              {inspectionSentence(row.published, row.withInspection, row.newestInspection)}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {SERIOUS_PROFILE_TAGS[row.code]?.note}
            </p>
            <DataFootnote source={row.regulatorLong} />
          </li>
        ))}
      </ul>
      <div className="mt-8 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] border-collapse text-left">
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
                  <Link href={`/${row.slug}`} className="font-medium text-navy underline-offset-2 hover:underline">
                    {row.name}
                  </Link>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                    {SERIOUS_PROFILE_TAGS[row.code]?.note}
                  </p>
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
    </>
  );
}

export async function SeriousCitationsByState() {
  const supabase = tryPublicSupabaseClient();
  const stats = supabase ? await loadStateMemoryCareStats(supabase) : null;

  return (
    <>
      <p className="text-[17px] leading-relaxed text-ink-2">
        Each row counts published memory care homes with a serious citation in the last 24 months.
      </p>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{SERIOUS_COUNT_SENTENCE}</p>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
        On a facility profile, the red tag can be narrower than this count. The note under each state says what that profile calls its top tag.
      </p>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
        A home with no inspection on file is not in the serious-citation count. The line for each state says how many published homes have an inspection, and the newest inspection date we hold.
      </p>
      {stats ? (
        <ReportTable stats={stats} />
      ) : (
        <p className="mt-8 text-[17px] leading-relaxed text-ink-2">
          The state counts could not be loaded.
        </p>
      )}
      <DataFootnote
        source="Inspection and deficiency rows on publishable homes"
        note="Same rule as the state table on /data."
      />
      <p className="mt-8 text-[17px] leading-relaxed text-ink-2">
        The same counts, without these notes, are on{" "}
        <Link href="/data" className="text-teal underline-offset-2 hover:underline">
          the dataset page
        </Link>
        .
      </p>
    </>
  );
}

export const SERIOUS_CITATIONS_ILLUSTRATION = ILLUSTRATION;
