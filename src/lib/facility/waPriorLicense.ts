import { dshsFormsUrl } from "@/lib/facility/complianceFlag";

/**
 * When DSHS reissues a license, we keep the public URL (slug still ends
 * with the old number) and update facilities.license_number. Reports stay
 * on the old BHForms / AFHForms page until DSHS files them under the new
 * number. This is display-only: no merge, no slug change.
 */

export function padWaLicense(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(10, "0");
}

/** Unpadded digits for a family-facing label (2141, not 0000002141). */
export function displayWaLicense(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || digits;
}

/**
 * Prior DSHS license when the slug was minted under the old number and
 * license_number has since been updated. Null when they already agree.
 */
export function priorWaLicenseFromSlug(
  slug: string | null | undefined,
  currentLicense: string | null | undefined,
): string | null {
  const match = /-(\d{3,10})$/.exec(slug ?? "");
  if (!match) return null;
  const prior = padWaLicense(match[1]);
  const current = padWaLicense(currentLicense);
  if (!prior || !current || prior === current) return null;
  return prior;
}

/** BHForms / AFHForms URL for the prior license, or null when there isn't one. */
export function priorWaDshsFormsUrl(
  slug: string | null | undefined,
  currentLicense: string | null | undefined,
  waFacilityType: string | null | undefined,
): string | null {
  const prior = priorWaLicenseFromSlug(slug, currentLicense);
  if (!prior) return null;
  return dshsFormsUrl(displayWaLicense(prior), waFacilityType);
}
