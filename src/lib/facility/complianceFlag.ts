export type ComplianceDoc = {
  type: string;
  date: string | null;
  url: string;
  lifted_by: string | null;
};

export type ComplianceFlag = {
  tier: 1 | 2 | 3;
  banner_text: string;
  docs: ComplianceDoc[];
  checked_at: string;
};

/** Adult family homes and assisted living use different DSHS forms pages. */
export function dshsFormsUrl(
  licenseNumber: string | null | undefined,
  waFacilityType: string | null | undefined,
): string | null {
  if (!licenseNumber || !licenseNumber.trim()) return null;
  const page = waFacilityType === "AFH" ? "AFHForms.aspx" : "BHForms.aspx";
  return `https://fortress.wa.gov/dshs/adsaapps/lookup/${page}?Lic=${encodeURIComponent(licenseNumber.trim())}`;
}
