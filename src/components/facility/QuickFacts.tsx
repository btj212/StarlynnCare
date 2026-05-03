import type { Facility } from "@/lib/types";
import { MemoryCareDesignationBasis } from "./MemoryCareDesignationBasis";

interface QuickFactsProps {
  facility: Facility;
  lastInspectionDate?: string | null;
  lastCitationDate?: string | null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "None on record";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface FactItemProps {
  label: string;
  value: React.ReactNode;
}

function FactItem({ label, value }: FactItemProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-sm font-medium text-ink leading-snug">{value}</span>
    </div>
  );
}

export function QuickFacts({ facility, lastInspectionDate, lastCitationDate }: QuickFactsProps) {
  const phone = facility.phone;
  const formattedPhone = phone
    ? phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3").replace(/\D+$/, "")
    : null;

  // Map thumbnail — shown only when coordinates + token are available
  const lat = facility.latitude ? parseFloat(facility.latitude) : null;
  const lon = facility.longitude ? parseFloat(facility.longitude) : null;
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const hasMap = lat && lon && mapToken;

  const googleMapsUrl = hasMap
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    : null;

  // 400x400@2x = crisp 200×200 display square
  const mapImgUrl = hasMap
    ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+c8a26b(${lon},${lat})/${lon},${lat},14/400x400@2x?access_token=${mapToken}`
    : null;

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-sc-border bg-white shadow-card">
      <div className="flex flex-col sm:flex-row">

        {/* ── Left: fact grid ── */}
        <div className="flex-1 min-w-0 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-4">
            Quick facts
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
            <FactItem
              label="Licensed beds"
              value={facility.beds != null ? String(facility.beds) : "—"}
            />
            <FactItem
              label="Memory care"
              value={
                facility.serves_memory_care ? (
                  <span className="inline-flex items-center gap-1 text-teal font-semibold text-sm">
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Yes
                  </span>
                ) : (
                  <span className="text-muted text-sm">Not listed</span>
                )
              }
            />
            <FactItem
              label="Last inspection"
              value={formatDate(lastInspectionDate ?? facility.last_inspection_date)}
            />
            <FactItem
              label="Last citation"
              value={lastCitationDate ? formatDate(lastCitationDate) : "None on record"}
            />
            {facility.operator_name && (
              <FactItem label="Operated by" value={facility.operator_name} />
            )}
            {formattedPhone && (
              <FactItem
                label="Phone"
                value={
                  <a
                    href={`tel:${phone}`}
                    className="text-teal hover:underline underline-offset-2"
                  >
                    {formattedPhone}
                  </a>
                }
              />
            )}
          </div>

          <MemoryCareDesignationBasis
            basis={facility.ca_memory_care_designation_basis}
            stateCode={facility.state_code}
          />
        </div>

        {/* ── Right: map thumbnail ── */}
        {hasMap && mapImgUrl && googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block shrink-0 border-t border-sc-border sm:border-t-0 sm:border-l overflow-hidden
                       h-[160px] sm:h-auto sm:w-[200px]"
            aria-label="View location in Google Maps"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapImgUrl}
              alt={`Map showing location of ${facility.name}`}
              width={400}
              height={400}
              className="w-full h-full object-cover transition-opacity group-hover:opacity-85"
              loading="lazy"
            />
          </a>
        )}
      </div>
    </div>
  );
}
