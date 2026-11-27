import { facilityDisplayName } from "@/lib/facility/aliases";

export type NearbyHome = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  city: string | null;
  latitude?: string | null;
  longitude?: string | null;
  publishable?: boolean | null;
  marketing_name?: string | null;
  name_aliases?: string[] | null;
  content?: {
    marketing_name?: string | null;
    name_aliases?: string[] | null;
  } | null;
};

function coord(value: string | null | undefined): number | null {
  if (value == null || !String(value).trim()) return null;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const sine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(sine)));
}

function byDisplayName(a: NearbyHome, b: NearbyHome): number {
  return facilityDisplayName(a).localeCompare(facilityDisplayName(b));
}

function sortHomes(
  rows: NearbyHome[],
  selfLat: number | null,
  selfLng: number | null,
): NearbyHome[] {
  if (selfLat == null || selfLng == null) return [...rows].sort(byDisplayName);
  return [...rows].sort((a, b) => {
    const aLat = coord(a.latitude);
    const aLng = coord(a.longitude);
    const bLat = coord(b.latitude);
    const bLng = coord(b.longitude);
    const aDistance = aLat != null && aLng != null ? haversineKm(selfLat, selfLng, aLat, aLng) : null;
    const bDistance = bLat != null && bLng != null ? haversineKm(selfLat, selfLng, bLat, bLng) : null;
    if (aDistance == null && bDistance == null) return byDisplayName(a, b);
    if (aDistance == null) return 1;
    if (bDistance == null) return -1;
    if (aDistance !== bDistance) return aDistance - bDistance;
    return byDisplayName(a, b);
  });
}

/**
 * Three published homes, same city first. Distance when both homes have
 * coordinates; otherwise alphabetical. The home itself is never included.
 */
export function pickNearbyFacilities(input: {
  selfId: string;
  citySlug: string;
  latitude?: string | null;
  longitude?: string | null;
  homes: NearbyHome[];
  limit?: number;
}): NearbyHome[] {
  const limit = input.limit ?? 3;
  const selfLat = coord(input.latitude);
  const selfLng = coord(input.longitude);
  const eligible = input.homes.filter(
    (home) => home.id !== input.selfId && home.publishable !== false,
  );
  const sameCity = eligible.filter((home) => home.city_slug === input.citySlug);
  const sameState = eligible.filter((home) => home.city_slug !== input.citySlug);
  const picked = sortHomes(sameCity, selfLat, selfLng).slice(0, limit);
  if (picked.length >= limit) return picked;
  const seen = new Set(picked.map((home) => home.id));
  for (const home of sortHomes(sameState, selfLat, selfLng)) {
    if (seen.has(home.id)) continue;
    picked.push(home);
    if (picked.length === limit) break;
  }
  return picked;
}
