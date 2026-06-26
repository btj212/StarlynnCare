import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";

type PhotoSource = { url: string; source: string; attribution: string };

function HeroPhoto({
  urls,
  name,
  photoSources,
}: {
  urls: string[];
  name: string;
  photoSources?: PhotoSource[];
}) {
  const primaryAttribution = photoSources?.[0]?.attribution;

  if (urls.length === 0) {
    return (
      <div
        className="h-[230px] md:h-[360px] w-full overflow-hidden"
        style={{ background: "linear-gradient(135deg, #C9D8C8 0%, #8FA89A 100%)" }}
      />
    );
  }

  return (
    <div className="relative">
      <div className="h-[230px] md:h-[360px] w-full overflow-hidden bg-ink-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[0]} alt={name} className="h-full w-full object-cover object-center" />
      </div>
      {primaryAttribution && primaryAttribution !== "© Google" && (
        <p className="mt-1 text-right font-[family-name:var(--font-mono)] text-[10px] text-ink-3/60 tracking-wide">
          {primaryAttribution}
        </p>
      )}
    </div>
  );
}

function FacilityMap({ profile }: { profile: FacilityProfile }) {
  const { facility, mapState } = profile;

  // Static Mapbox tile when configured
  if (mapState?.mapboxToken && mapState.lat && mapState.lon) {
    const { lat, lon, mapboxToken } = mapState;
    const mapImgUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+B8533A(${lon},${lat})/${lon},${lat},14/800x720@2x?access_token=${mapboxToken}`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    return (
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block h-[230px] md:h-[360px] overflow-hidden bg-paper-2"
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
    <div className="relative h-[230px] md:h-[360px] overflow-hidden bg-paper-2">
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
    <section id="snapshot" className="scroll-mt-36 md:scroll-mt-28 border-b border-paper-rule py-10 md:py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="Snapshot"
          title={
            headline ? (
              <>{headline.split(",")[0]}, <em>{headline.split(",").slice(1).join(",").trim() || "reviewed on public record."}</em></>
            ) : (
              <>A {facility.capacity_tier ?? "care"} home, <em>reviewed on public record.</em></>
            )
          }
          deck={intro ?? undefined}
        />

        <div className="grid grid-cols-2 gap-2 sm:gap-7 md:grid-cols-[1.5fr_1fr]">
          {/* AFH residential privacy: omit exterior photo and street-level map */}
          {profile.isAfhResidential ? (
            <div
              className="h-[230px] md:h-[360px] w-full overflow-hidden flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #C9D8C8 0%, #8FA89A 100%)" }}
            >
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-white/70 text-center px-4">
                Adult Family Home · exterior photo withheld for resident privacy
              </span>
            </div>
          ) : (
            <HeroPhoto urls={profile.photoUrls} name={facility.name} photoSources={profile.photoSources} />
          )}
          {profile.isAfhResidential ? (
            <div className="h-[230px] md:h-[360px] w-full overflow-hidden flex items-center justify-center bg-paper-2">
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-ink/40 text-center px-4">
                Street view omitted · residential privacy
              </span>
            </div>
          ) : (
            <FacilityMap profile={profile} />
          )}
        </div>
      </div>
    </section>
  );
}
