/** A Washington adult family home stays unpublished until DSHS documents are checked,
 * and stays unpublished while a Tier 1 flag is waiting on a person. */
export function waAfhBlocksPublish(
  facility: {
    state_code: string;
    wa_facility_type: string | null;
    state_records_checked_at: string | null;
  },
  flag: { tier: number; review_status: string | null } | null,
): boolean {
  if (facility.state_code !== "WA" || facility.wa_facility_type !== "AFH") return false;
  if (!facility.state_records_checked_at) return true;
  return flag?.tier === 1 && flag.review_status !== "approved";
}
