import Link from "next/link";
import { SectionHead } from "@/components/editorial/SectionHead";
import { formatFacilityName } from "@/lib/facility/displayName";
import { facilityAliases, facilityDisplayName } from "@/lib/facility/aliases";

type IndexHome = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  beds: number | null;
  total_citations: number;
  inspections?: number;
  marketing_name?: string | null;
  name_aliases?: string[] | null;
};

type Props = {
  homes: IndexHome[];
  stateSlug: string;
  regionName: string;
};

function citationLabel(count: number, inspections?: number): string {
  if (inspections === 0) return "no inspections on file yet";
  return `${count} ${count === 1 ? "citation" : "citations"} (all years)`;
}

/**
 * A to Z list of every indexable home in a city. The card grid above it shows
 * only the first 24; this list is what lets a crawler reach the rest.
 */
export function CityHomeIndex({ homes, stateSlug, regionName }: Props) {
  if (homes.length === 0) return null;

  return (
    <div
      id="all-homes"
      className="border-t border-clearing-rule"
      style={{ background: "var(--color-paper-2)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-[60px]">
        <SectionHead
          label={`§ All ${homes.length} homes`}
          title={
            <>
              Every home in {regionName}, <em>A to Z.</em>
            </>
          }
          deck="Each link opens that home's inspection record. Citation counts are all years on file in the state inspection record."
        />
        <ul className="m-0 grid list-none gap-x-8 gap-y-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((home) => {
            const aka = facilityAliases(home).marketingName;
            return (
            <li key={home.id} className="min-w-0">
              <Link
                href={`/${stateSlug}/${home.city_slug}/${home.slug}`}
                className="block text-[15px] leading-snug text-teal underline-offset-4 hover:underline"
              >
                {facilityDisplayName(home)}
              </Link>
              {aka ? (
                <span className="block font-[family-name:var(--font-sans)] text-[12px] text-ink-3">
                  Also known as {formatFacilityName(aka)}
                </span>
              ) : null}
              <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-3">
                {home.beds != null ? `${home.beds} beds · ` : ""}
                {citationLabel(home.total_citations, home.inspections)}
              </span>
            </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
