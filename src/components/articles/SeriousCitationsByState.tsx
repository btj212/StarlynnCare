import Link from "next/link";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import {
  formatRecordDate,
  loadStateMemoryCareStats,
  type StateMemoryCareStat,
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

/**
 * A row is a state result only when the serious count can be measured.
 * Fewer than 25 published homes is a stub. Texas is 1, and the next covered state is 30.
 * Under half inspected is a partial file. Washington is about a third; every other covered state is above 96%.
 * Half or more of recent findings with no class and no severity makes the count, including a zero, unmeasured.
 */
const MIN_PUBLISHED_FOR_STATE_COUNT = 25;

function omissionKind(row: StateMemoryCareStat): "published" | "inspections" | "uncoded" | null {
  if (row.published < MIN_PUBLISHED_FOR_STATE_COUNT) return "published";
  if (row.withInspection * 2 < row.published) return "inspections";
  if (row.findings > 0 && row.uncodedFindings * 2 >= row.findings) return "uncoded";
  return null;
}

function omissionSentence(row: StateMemoryCareStat): string {
  const kind = omissionKind(row);
  if (kind === "published") {
    const homes = row.published === 1 ? "home" : "homes";
    return `${row.name} has ${formatCount(row.published)} published ${homes} in this directory. That is not a state count.`;
  }
  if (kind === "inspections") {
    return `${row.name} has an inspection on file for ${formatCount(row.withInspection)} of ${formatCount(row.published)} published homes.`;
  }
  return `${row.name} has ${formatCount(row.uncodedFindings)} of ${formatCount(row.findings)} findings in the last 24 months with no citation class and no stored severity. A serious count is not shown.`;
}

function inspectionSentence(published: number, withInspection: number, newest: string | null): string {
  const date = formatRecordDate(newest);
  const coverage =
    withInspection === published
      ? `All ${formatCount(published)} published homes have an inspection on file.`
      : `${formatCount(withInspection)} of ${formatCount(published)} published homes have an inspection on file.`;
  return date ? `${coverage} The newest inspection date we hold is ${date}.` : coverage;
}

function ReportTable({ rows }: { rows: StateMemoryCareStat[] }) {
  return (
    <>
      <ul className="mt-8 divide-y divide-sc-border md:hidden">
        {rows.map((row) => (
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
            {rows.map((row) => (
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
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">
        Which states are left out?
      </h2>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
        This table leaves out a state when the serious count would not be a measurement. The{" "}
        <Link href="/data" className="text-teal underline-offset-2 hover:underline">
          dataset page
        </Link>{" "}
        still lists every covered state.
      </p>
      {stats ? (
        <>
          {stats.rows.some((row) => omissionKind(row) != null) ? (
            stats.rows
              .filter((row) => omissionKind(row) != null)
              .map((row) => (
                <p key={row.code} className="mt-4 text-[17px] leading-relaxed text-ink-2">
                  {omissionSentence(row)}
                </p>
              ))
          ) : (
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">No covered state is left out.</p>
          )}
          <ReportTable rows={stats.rows.filter((row) => omissionKind(row) == null)} />
        </>
      ) : (
        <p className="mt-8 text-[17px] leading-relaxed text-ink-2">
          The state counts could not be loaded.
        </p>
      )}
      <DataFootnote
        source="Inspection and deficiency rows on publishable homes"
        note="Same rule as the state table on /data. This table leaves out a state the dataset page still lists."
      />
    </>
  );
}

export const SERIOUS_CITATIONS_ILLUSTRATION = ILLUSTRATION;
