/**
 * Regulator license status as the state file stored it. Display only —
 * this does not change publishable / listed / sitemap.
 */

export type LicenseStatusTone = "ok" | "warn" | "danger" | "info";

export type LicenseStatusDisplay = {
  label: string;
  tone: LicenseStatusTone;
  /** True when the state says the license is not in ordinary good standing. */
  notable: boolean;
};

const KNOWN: Record<string, LicenseStatusDisplay> = {
  LICENSED: { label: "Licensed", tone: "ok", notable: false },
  CERTIFIED: { label: "Certified", tone: "ok", notable: false },
  "ON PROBATION": { label: "Probationary license", tone: "danger", notable: true },
  PROBATIONARY: { label: "Probationary license", tone: "danger", notable: true },
  CLOSED: { label: "Closed", tone: "danger", notable: true },
  PENDING: { label: "Pending", tone: "warn", notable: true },
  "PDR-APPEAL PEND": {
    label: "Provisional decision pending appeal",
    tone: "warn",
    notable: true,
  },
};

export function formatLicenseStatus(
  raw: string | null | undefined,
): LicenseStatusDisplay | null {
  const value = raw?.trim();
  if (!value) return null;
  const known = KNOWN[value.toUpperCase()];
  if (known) return known;
  return { label: value, tone: "info", notable: true };
}
