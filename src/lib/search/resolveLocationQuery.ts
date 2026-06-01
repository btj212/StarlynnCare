import { REGIONS } from "@/lib/regions";

function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripStateSuffix(text: string): string {
  return text
    .trim()
    .replace(/,\s*(ca|california|or|oregon|wa|washington|mn|minnesota|tx|texas)\s*$/i, "")
    .trim();
}

/** Map a city or county name to a listing hub URL, or null if unknown. */
export function resolveLocationQuery(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /^\d+$/.test(trimmed)) return null;

  const normalized = stripStateSuffix(trimmed);
  const slug = toSlug(normalized);
  const lower = normalized.toLowerCase();

  const bySlug = REGIONS.find((r) => r.slug === slug);
  if (bySlug) return `/${bySlug.state.slug}/${bySlug.slug}`;

  const byName = REGIONS.find((r) => r.name.toLowerCase() === lower);
  if (byName) return `/${byName.state.slug}/${byName.slug}`;

  return null;
}
