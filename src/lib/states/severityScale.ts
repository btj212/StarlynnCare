/**
 * True when the regulator publishes a severity scale and the profile may
 * name it. California Type A/B, Illinois Type 1/2/3, Oregon levels, Colorado
 * Level A–E, and CMS or CDPHE grids. Other states do not get a "severe" or
 * "serious finding" sentence from an integer we stored.
 */
export function regulatorPublishesSeverityScale(
  stateCode: string,
  scope?: "cms" | "cdphe" | null,
): boolean {
  if (scope === "cms" || scope === "cdphe") return true;
  return ["CA", "IL", "OR", "CO"].includes(stateCode.toUpperCase());
}
