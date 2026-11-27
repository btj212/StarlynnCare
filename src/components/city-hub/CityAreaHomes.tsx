import Link from "next/link";
import { SectionHead } from "@/components/editorial/SectionHead";
import { formatFacilityName } from "@/lib/facility/displayName";

export type AreaHomeLink = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
};

/**
 * Homes that belong in a city's answer but not in its listed count.
 * Vancouver uses this for Memory Care Certified ALFs filed under
 * unincorporated Clark County place slugs.
 */
export function CityAreaHomes({
  stateSlug,
  homes,
}: {
  stateSlug: string;
  homes: AreaHomeLink[];
}) {
  if (homes.length === 0) return null;
  return (
    <section className="border-b border-clearing-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-[60px]">
        <SectionHead
          label="Vancouver mailing address"
          title={<>Vancouver-address homes in unincorporated Clark County</>}
        />
        <p className="max-w-[72ch] text-[16px] leading-[1.7] text-ink-2">
          These {homes.length} memory care certified assisted living facilities have Vancouver
          mailing addresses but sit outside city limits, so DSHS and the Census file them under
          unincorporated Clark County places.
        </p>
        <ul className="m-0 mt-6 grid max-w-[72ch] list-none gap-2 p-0 sm:grid-cols-2">
          {homes.map((home) => (
            <li key={home.id}>
              <Link
                href={`/${stateSlug}/${home.city_slug}/${home.slug}`}
                className="text-[15px] text-teal underline underline-offset-4"
              >
                {formatFacilityName(home.name)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
