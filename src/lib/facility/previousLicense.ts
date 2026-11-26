import { formatFacilityName } from "@/lib/facility/displayName";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

export type PreviousLicense = {
  name: string;
  licenseNumber: string | null;
  licenseStatus: string | null;
  /** Set only when the prior row is still a public profile. */
  href: string | null;
};

function normalizeStreet(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\blane\b/g, "ln")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isClosedStatus(status: string | null): boolean {
  if (!status) return false;
  return /closed|expired|surrendered|inactive|revoked|cancelled|canceled/i.test(status);
}

/**
 * Other licenses at the same street + ZIP, including unpublished closed rows.
 * Display only. Does not merge records and does not write the database.
 */
export async function loadPreviousLicensesAtAddress(input: {
  id: string;
  stateCode: string;
  street: string | null;
  zip: string | null;
  stateSlug: string;
}): Promise<PreviousLicense[]> {
  const street = input.street?.trim();
  const zip = input.zip?.trim().slice(0, 5);
  if (!street || !zip) return [];

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, license_number, license_status, slug, city_slug, publishable, street")
    .eq("state_code", input.stateCode)
    .like("zip", `${zip}%`)
    .neq("id", input.id)
    .limit(25);

  if (error || !data) return [];

  const needle = normalizeStreet(street);
  if (!needle) return [];

  const out: PreviousLicense[] = [];
  for (const row of data as Array<{
    id: string;
    name: string;
    license_number: string | null;
    license_status: string | null;
    slug: string;
    city_slug: string;
    publishable: boolean;
    street: string | null;
  }>) {
    if (!row.street || normalizeStreet(row.street) !== needle) continue;
    if (row.publishable && !isClosedStatus(row.license_status)) continue;
    out.push({
      name: formatFacilityName(row.name),
      licenseNumber: row.license_number,
      licenseStatus: row.license_status,
      href:
        row.publishable
          ? `/${input.stateSlug}/${row.city_slug}/${row.slug}`
          : null,
    });
  }
  return out;
}
