import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";

function PhotoGallery({ urls, name }: { urls: string[]; name: string }) {
  if (urls.length === 0) {
    return (
      <div className="grid h-[460px] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`relative overflow-hidden ${i === 0 ? "row-span-2" : ""}`}
            style={{
              background: i === 0
                ? "linear-gradient(135deg, #C9D8C8 0%, #8FA89A 100%)"
                : i === 1 ? "linear-gradient(135deg, #D6CFB8 0%, #A89D7E 100%)"
                : i === 2 ? "linear-gradient(135deg, #C8B49A 0%, #8E7A60 100%)"
                : i === 3 ? "linear-gradient(135deg, #BDC8B9 0%, #7E8A77 100%)"
                : "linear-gradient(135deg, #E0CFB8 0%, #B0A084 100%)",
            }}
          >
            <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-white/75">
              Photo
            </span>
          </div>
        ))}
      </div>
    );
  }

  // With a single photo: big-left, blank slots on right
  const [primary, ...rest] = urls;
  return (
    <div className="grid h-[460px] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-1">
      <div className="relative row-span-2 overflow-hidden bg-ink-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={primary} alt={name} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden"
          style={{
            background: i === 0 ? "linear-gradient(135deg, #D6CFB8 0%, #A89D7E 100%)"
              : i === 1 ? "linear-gradient(135deg, #C8B49A 0%, #8E7A60 100%)"
              : i === 2 ? "linear-gradient(135deg, #BDC8B9 0%, #7E8A77 100%)"
              : "linear-gradient(135deg, #E0CFB8 0%, #B0A084 100%)",
          }}
        >
          {rest[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rest[i]} alt={`${name} photo ${i + 2}`} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-white/75">
              Photo
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function FacilityMap({ profile }: { profile: FacilityProfile }) {
  const { facility, mapState } = profile;

  // Static Mapbox tile when configured
  if (mapState?.mapboxToken && mapState.lat && mapState.lon) {
    const { lat, lon, mapboxToken } = mapState;
    const mapImgUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+B8533A(${lon},${lat})/${lon},${lat},14/800x920@2x?access_token=${mapboxToken}`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    return (
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block h-[460px] overflow-hidden bg-paper-2"
        aria-label="View location in Google Maps"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapImgUrl}
          alt={`Map showing location of ${facility.name}`}
          className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
          loading="lazy"
        />
        <div className="absolute bottom-2 left-2 bg-paper/85 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] text-ink-3 tracking-[0.04em]">
          © Mapbox · OpenStreetMap
        </div>
      </a>
    );
  }

  // Fallback: SVG gridpaper sketch
  return (
    <div className="relative h-[460px] overflow-hidden bg-paper-2">
      <svg
        viewBox="0 0 400 460"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {[...Array(8)].map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 60 + 30} x2="400" y2={i * 60 + 30} stroke="#C5BAA0" strokeWidth="0.5" />
        ))}
        {[...Array(7)].map((_, i) => (
          <line key={`v${i}`} x1={i * 60 + 30} y1="0" x2={i * 60 + 30} y2="460" stroke="#C5BAA0" strokeWidth="0.5" />
        ))}
        <path d="M 0 200 Q 100 180 200 220 T 400 200" fill="none" stroke="#A89D7E" strokeWidth="2" />
        <path d="M 60 0 Q 80 100 100 230 T 140 460" fill="none" stroke="#A89D7E" strokeWidth="1.5" />
        <path d="M 280 0 Q 260 120 280 260 T 320 460" fill="none" stroke="#A89D7E" strokeWidth="1.5" />
        <rect x="170" y="190" width="60" height="40" fill="#D9CFB8" stroke="#A89D7E" strokeWidth="0.5" />
        {facility.city && (
          <text x="14" y="80" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#5A6660" letterSpacing="0.06em">
            {facility.city.toUpperCase()}
          </text>
        )}
      </svg>
      {/* Pin */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <div className="relative h-7 w-7 rounded-full border-[3px] border-paper bg-rust shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
          <div className="absolute -bottom-2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-rust" />
        </div>
      </div>
      <div className="absolute bottom-2 left-2 bg-paper/85 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] text-ink-3 tracking-[0.04em]">
        Approximate location
      </div>
    </div>
  );
}

export function FacilitySnapshot({ profile }: { profile: FacilityProfile }) {
  const { facility } = profile;

  // Generate a one-liner headline
  const content = profile.facility.content as { headline?: string; intro?: string } | null;
  const headline = content?.headline ?? null;
  const intro = content?.intro ?? null;

  return (
    <section id="snapshot" className="border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="§ 01 · Snapshot"
          title={
            headline ? (
              <>{headline.split(",")[0]}, <em>{headline.split(",").slice(1).join(",").trim() || "highly rated."}</em></>
            ) : (
              <>A {facility.capacity_tier ?? "care"} home, <em>reviewed on public record.</em></>
            )
          }
          deck={intro ?? undefined}
        />

        <div className="grid gap-7 md:grid-cols-[1.5fr_1fr]">
          <PhotoGallery urls={profile.photoUrls} name={facility.name} />
          <FacilityMap profile={profile} />
        </div>
      </div>
    </section>
  );
}
