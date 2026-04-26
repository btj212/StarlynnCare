/**
 * FacilityMap — static location map using Mapbox Static Images API.
 *
 * Server Component — renders a plain <img> tag; zero client JS.
 *
 * Setup: add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx to .env.local
 * (free tier: mapbox.com — public tokens start with "pk.")
 *
 * If the token is absent or the facility has no coordinates, renders null.
 */

import type { Facility } from "@/lib/types";

interface FacilityMapProps {
  facility: Facility;
}

export function FacilityMap({ facility }: FacilityMapProps) {
  const lat = facility.latitude ? parseFloat(facility.latitude) : null;
  const lon = facility.longitude ? parseFloat(facility.longitude) : null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!lat || !lon) return null;
  if (!token) return null;

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  const addressParts = [facility.street, facility.city].filter(Boolean);
  const addressLabel = addressParts.join(", ");

  // Mapbox Static Images API
  // pin-s+c8a26b  = small pin in accent gold (#C8A26B)
  // zoom 14       = ~1.5-mile neighborhood context
  // 800x320@2x    = sharp on retina
  const marker = `pin-s+c8a26b(${lon},${lat})`;
  const center = `${lon},${lat},14`;
  const mapUrl = [
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static`,
    `/${marker}/${center}/800x320@2x`,
    `?access_token=${token}`,
  ].join("");

  return (
    <div className="mt-6">
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-xl border border-sc-border shadow-card"
        aria-label={`View ${facility.name} in Google Maps`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt={`Neighborhood map showing location of ${facility.name}`}
          width={800}
          height={320}
          className="w-full object-cover h-[180px] sm:h-[240px] transition-opacity group-hover:opacity-90"
          loading="lazy"
        />
      </a>
      <p className="mt-1.5 text-xs text-muted">
        {addressLabel && <>{addressLabel} — </>}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-teal hover:underline underline-offset-2"
        >
          view in Maps
        </a>
      </p>
    </div>
  );
}
