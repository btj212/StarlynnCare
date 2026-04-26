/**
 * Single production origin for canonical URLs and JSON-LD @id bases.
 * Override in preview/staging via NEXT_PUBLIC_SITE_URL if needed.
 */
export const SITE_ORIGIN =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "")) ||
  "https://www.starlynncare.com";

/** Absolute canonical URL for a path (e.g. `/california/oakland` or `california/oakland`). */
export function canonicalFor(path: string): string {
  let p = path.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  const noTrail = p.replace(/\/+$/, "") || "/";
  return noTrail === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${noTrail}`;
}
