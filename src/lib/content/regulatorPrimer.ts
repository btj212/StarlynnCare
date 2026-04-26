/**
 * Returns a state-specific regulator primer paragraph used on every city hub page.
 * Keyed by two-letter state code. Falls back to a generic paragraph for unmapped states.
 *
 * Update this map when expanding to new states so every city page in that state gets
 * the correct jurisdiction-specific copy — one edit, all cities.
 */
export function getRegulatorPrimer(stateCode: string): string {
  const code = stateCode.toUpperCase();
  const primers: Record<string, string> = {
    CA: `Memory care facilities in California are licensed as Residential Care Facilities for the Elderly (RCFEs) and regulated by the California Department of Social Services (CDSS), Community Care Licensing Division. Each facility must pass annual unannounced inspections; any citations or deficiencies are entered into the public CDSS record. Type-A deficiencies indicate immediate health and safety risk; Type-B indicate lesser violations. StarlynnCare pulls this record directly, weekly, and uses it as the primary input to every grade. Read our <a href="/methodology">full methodology</a> for detail on how each citation type is weighted.`,
  };
  return (
    primers[code] ??
    `Memory care facilities in this state are licensed and regulated by the relevant state health or social services authority, which conducts unannounced inspections and records deficiency findings in a public record. StarlynnCare uses this public inspection record as the primary input to every grade. Read our <a href="/methodology">full methodology</a> for detail.`
  );
}
