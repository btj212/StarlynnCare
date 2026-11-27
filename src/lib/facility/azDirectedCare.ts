/**
 * The only Directed Care signal.
 *
 * The ADHS directory ingest writes this on `az_license_level` when the
 * license subtype ends in "-DIRECTED". `headlineLabel` and `memoryCareBasis`
 * both call this so a Personal Care row cannot pick up the Directed Care
 * label from a state-wide fallback.
 */
export function azDirectedCareLicense(level: string | null | undefined): boolean {
  return level?.trim() === "Directed Care";
}
