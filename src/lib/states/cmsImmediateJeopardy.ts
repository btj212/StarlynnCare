/**
 * Immediate Jeopardy is a CMS nursing-home term (scope-and-severity J, K, L
 * on an F-tag). State assisted-living files use their own words: California
 * Type A / Type B, Pennsylvania substantiated abuse, Arizona A.A.C. findings.
 * Display uses this helper so a stored `immediate_jeopardy` flag is not enough.
 */

export const CMS_IJ_LABEL = "Immediate Jeopardy (CMS)";

export function isCmsFTag(code: string | null | undefined): boolean {
  return /^F\d{3,4}\b/i.test(code?.trim() ?? "");
}

export function cmsScopeLetter(d: {
  scope_severity_code?: string | null;
  state_severity_raw?: string | null;
}): string | null {
  const fromCode = d.scope_severity_code?.trim().toUpperCase() ?? "";
  if (/^[A-L]$/.test(fromCode)) return fromCode;
  const raw = d.state_severity_raw?.trim().toUpperCase() ?? "";
  if (/^[A-L]$/.test(raw)) return raw;
  return null;
}

export function isCmsImmediateJeopardy(d: {
  code?: string | null;
  scope_severity_code?: string | null;
  state_severity_raw?: string | null;
  immediate_jeopardy?: boolean | null;
}): boolean {
  const letter = cmsScopeLetter(d);
  if (letter && "JKL".includes(letter)) return true;
  return isCmsFTag(d.code) && d.immediate_jeopardy === true;
}
