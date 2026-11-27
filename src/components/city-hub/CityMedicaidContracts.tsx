import Link from "next/link";
import { SectionHead } from "@/components/editorial/SectionHead";
import { formatFacilityName } from "@/lib/facility/displayName";
import { medicaidContractLabel } from "@/lib/city-hub/municipality";

export type MedicaidHome = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  wa_contract_types?: string[] | null;
  wa_dementia_care_contract?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
};

const DSHS_LOOKUP = "https://fortress.wa.gov/dshs/adsaapps/lookup/BHAdvLookup.aspx";

export function CityMedicaidContracts({
  stateSlug,
  homes,
}: {
  stateSlug: string;
  homes: MedicaidHome[];
}) {
  if (homes.length === 0) return null;
  return (
    <section className="border-b border-clearing-rule" style={{ background: "var(--color-paper-2)" }}>
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-[60px]">
        <SectionHead
          label="Medicaid"
          title={<>Which Vancouver memory care homes accept Medicaid?</>}
        />
        <p className="max-w-[72ch] text-[16px] leading-[1.7] text-ink-2">
          Only a DSHS Specialized Dementia Care contract lets a home accept Medicaid for dementia
          care. Enhanced Adult Residential Care is a different Medicaid contract. Contract types
          below are the DSHS labels on file.{" "}
          <a
            href={DSHS_LOOKUP}
            className="text-teal underline underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            Check the DSHS assisted living lookup
          </a>
          .
        </p>
        <ul className="m-0 mt-6 max-w-[72ch] list-none space-y-3 p-0">
          {homes.map((home) => (
            <li key={home.id} className="text-[15px] leading-snug text-ink">
              <Link
                href={`/${stateSlug}/${home.city_slug}/${home.slug}`}
                className="font-medium text-teal underline underline-offset-4"
              >
                {formatFacilityName(home.name)}
              </Link>
              <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[12px] text-ink-3">
                {medicaidContractLabel(home)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
