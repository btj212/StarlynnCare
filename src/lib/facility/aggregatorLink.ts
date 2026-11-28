/**
 * Lead-gen and directory hosts are not the home's website.
 * A link to one of these is omitted. The stored row is left as it is.
 */
const AGGREGATOR_HOSTS = [
  "senioradvisor.com",
  "caring.com",
  "aplaceformom.com",
  "seniorly.com",
  "assistedliving.org",
  "assistedliving.com",
  "seniorliving.org",
  "whereyoulivematters.org",
  "oasissenioradvisors.com",
  "seniorhomes.com",
  "agingcare.com",
  "carelistings.com",
  "seniorcarehomes.com",
  "memorycare.com",
];

function hostname(raw: string): string | null {
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isAggregatorUrl(raw: string | null | undefined): boolean {
  const host = raw?.trim() ? hostname(raw.trim()) : null;
  if (!host) return false;
  return AGGREGATOR_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

/** A facility or source URL that is safe to render. Aggregator URLs are null. */
export function linkableFacilityUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || isAggregatorUrl(trimmed)) return null;
  return trimmed;
}
